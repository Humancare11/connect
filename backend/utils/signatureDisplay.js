// How big an image signature is SHOWN in a mail (and in the dashboard), in CSS pixels.
// The file is stored at up to 2x (see signatureImage.js) so it stays sharp on high-resolution
// screens; it is displayed at most DISPLAY_WIDTH wide, like a signature written in Gmail.
// A smaller image is never enlarged. The height follows the proportions: nothing is cropped.
const DISPLAY_WIDTH = 500;

function displaySize(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const shown = Math.min(DISPLAY_WIDTH, w);
  return { width: shown, height: Math.max(1, Math.round((shown * h) / w)) };
}

module.exports = { DISPLAY_WIDTH, displaySize };
