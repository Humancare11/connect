// Shared PDF rendering for the letterhead slips (prescription + medical
// certificate). Captures the slip with html2canvas at a fixed layout width,
// then lays it onto A4 pages, breaking between blocks (never through a line of
// text or a table row) and keeping a consistent margin on every page.

const CAPTURE_WINDOW_WIDTH = 1200;
const SCALE = 2;
const PAGE_MARGIN_PX = 24; // top/bottom margin on multi-page output (CSS px)
const A4_RATIO = 297 / 210;

// Vertical extents (relative to the slip's top, CSS px) that a page break must
// not fall inside: table rows, images and any element that only holds text.
function collectUnbreakable(clonedEl) {
  const top = clonedEl.getBoundingClientRect().top;
  const blocks = [];
  clonedEl.querySelectorAll("*").forEach((node) => {
    const tag = node.tagName;
    const isLeafText =
      node.children.length === 0 && node.textContent.trim().length > 0;
    if (tag !== "TR" && tag !== "IMG" && tag !== "svg" && !isLeafText) return;
    const r = node.getBoundingClientRect();
    if (r.height < 1) return;
    blocks.push([r.top - top, r.bottom - top]);
  });
  return blocks;
}

function pickBreak(blocks, from, target) {
  // Search upward from `target` for a y that no block straddles.
  const floor = from + (target - from) * 0.55;
  const candidates = [target];
  blocks.forEach(([, bottom]) => {
    if (bottom > floor && bottom <= target) candidates.push(bottom);
  });
  candidates.sort((a, b) => b - a);
  for (const y of candidates) {
    const cuts = blocks.some(([t, b]) => t < y - 0.5 && b > y + 0.5);
    if (!cuts) return y;
  }
  return target; // nothing safe nearby (e.g. one huge block) — hard break
}

/**
 * @param {HTMLElement} element  slip root (kept at its natural layout width)
 * @param {string} filename
 * @param {number} slipWidth    the slip's design width in CSS px
 */
export async function renderSlipToPdf(element, filename, slipWidth) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  await document.fonts.ready;
  // Every image (logo, QR) must be decoded before the capture.
  await Promise.all(
    [...element.querySelectorAll("img")].map((img) =>
      img.complete ? null : img.decode().catch(() => {}),
    ),
  );

  let blocks = [];

  const canvas = await html2canvas(element, {
    scale: SCALE,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    // Lay the clone out at a fixed viewport so the capture doesn't depend on
    // the browser window size (media queries, responsive reflow).
    windowWidth: CAPTURE_WINDOW_WIDTH,
    onclone: (clonedDoc, clonedEl) => {
      // A modal entrance animation (scale) on an ancestor restarts in the
      // clone and shrinks everything slightly; freeze ancestors and pin the
      // slip to its real width.
      for (let node = clonedEl.parentElement; node; node = node.parentElement) {
        node.style.animation = "none";
        node.style.transform = "none";
      }
      clonedEl.style.width = `${slipWidth}px`;
      clonedEl.style.maxWidth = "none";
      clonedEl.style.transform = "none";

      // A gradient on a zero-size box crashes html2canvas; drop it there.
      const view = clonedDoc.defaultView;
      [clonedEl, ...clonedEl.querySelectorAll("*")].forEach((node) => {
        if (!/gradient/.test(view.getComputedStyle(node).backgroundImage))
          return;
        const { width, height } = node.getBoundingClientRect();
        if (width < 1 || height < 1) node.style.backgroundImage = "none";
      });

      blocks = collectUnbreakable(clonedEl);
    },
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfPageH = pdf.internal.pageSize.getHeight();

  const pxPerCanvasPx = slipWidth / canvas.width; // canvas px -> CSS px
  const totalH = canvas.height * pxPerCanvasPx; // slip height in CSS px
  const pageH = slipWidth * A4_RATIO; // one A4 page in CSS px
  const mmPerPx = pdfW / slipWidth;

  const addSlice = (fromPx, toPx, topPx) => {
    const sy = Math.round(fromPx / pxPerCanvasPx);
    const sh = Math.max(1, Math.round((toPx - fromPx) / pxPerCanvasPx));
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sh;
    const ctx = slice.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.97),
      "JPEG",
      0,
      topPx * mmPerPx,
      pdfW,
      (sh * pxPerCanvasPx) * mmPerPx,
    );
  };

  // One page (0.5mm tolerance so an exactly-one-page slip never spills over).
  if (totalH * mmPerPx <= pdfPageH + 0.5) {
    addSlice(0, totalH, 0);
    pdf.save(filename);
    return;
  }

  // Multi-page: first page runs edge to edge at the top (letterhead bar) with
  // a bottom margin; later pages get a margin top and bottom.
  let y = 0;
  let first = true;
  while (y < totalH - 0.5) {
    const topOffset = first ? 0 : PAGE_MARGIN_PX;
    const usable = pageH - topOffset - PAGE_MARGIN_PX;
    const remaining = totalH - y;
    const end =
      remaining <= usable ? totalH : pickBreak(blocks, y, y + usable);
    if (!first) pdf.addPage();
    addSlice(y, end, topOffset);
    y = end;
    first = false;
  }

  pdf.save(filename);
}
