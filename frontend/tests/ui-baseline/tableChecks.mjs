// Measures the Appointments list as drawn in a real browser page: which layout it is in, the width of each column, whether
// anything scrolls sideways, whether a date, fee or action cell is clipped, and whether every row's buttons sit on one line.
// Used by the Appointments browser tests (page alone) and by the screenshot script (inside the admin layout).
export async function measureTable(page) {
  return page.evaluate(() => {
    const table = document.querySelector("table.adp-bk");
    const wrap = document.querySelector(".adp-bk-wrap");
    if (!table || !wrap) return null;
    const cards = getComputedStyle(table).display === "block";
    const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).display !== "none";
    const columns = cards
      ? []
      : [...table.querySelectorAll("thead th")].filter(visible).map((th) => ({
          name: th.textContent.trim() || "#",
          width: Math.round(th.getBoundingClientRect().width * 10) / 10,
        }));

    const clipped = [];
    const multiLine = [];
    for (const tr of table.querySelectorAll("tbody tr")) {
      const label = tr.querySelector('td[data-label="Patient"]')?.textContent.trim().slice(0, 24) || "?";
      for (const selector of ["td.adp-bk-date", "td.adp-bk-fee", "td.adp-bk-actions-cell", "td.adp-bk-status", 'td[data-label="Booking ID"]']) {
        const td = tr.querySelector(selector);
        if (td && td.scrollWidth > td.clientWidth + 1) clipped.push(`${label}: ${selector}`);
      }
      const actions = tr.querySelector(".adp-bk-actions");
      if (actions) {
        const kids = [...actions.children];
        const tops = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top)));
        if (tops.size > 1) multiLine.push(label);
        // every button inside the cell's own box (nothing pushed past the right edge)
        const cell = actions.closest("td");
        const cellRight = cell.getBoundingClientRect().right;
        if (!cards && kids.some((k) => k.getBoundingClientRect().right > cellRight + 0.5)) clipped.push(`${label}: buttons past the cell edge`);
      }
    }
    // ellipsis only where asked for: Patient, Doctor and Category cut long text, and keep the full text as the hover text
    const cutCells = [...table.querySelectorAll("tbody tr:first-child td.adp-bk-cut")].filter(visible).map((td) => td.getAttribute("data-label"));

    return {
      layout: cards ? "cards" : "table",
      docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      wrapOverflow: wrap.scrollWidth - wrap.clientWidth,
      wrapWidth: Math.round(wrap.clientWidth),
      columns,
      clipped,
      multiLine,
      cutCells,
    };
  });
}

// The widths the spec fixes, by header text.
export const FIXED_WIDTHS = { "#": 40, "Booking ID": 88, Booked: 104, Consultation: 112, Fee: 92, Status: 132, Actions: 248 };
