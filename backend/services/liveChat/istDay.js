// The live-chat "day" for the daily cleanup and Archive temp: India Standard Time (Asia/Kolkata), a fixed +05:30
// offset with no daylight saving, so plain arithmetic is exact.
const IST_OFFSET_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

// "YYYY-MM-DD" of the IST calendar day that contains `ms`.
const istDayKey = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

// The instant (Date) the IST day `key` starts, i.e. midnight IST.
const istDayStart = (key) => new Date(Date.parse(`${key}T00:00:00.000Z`) - IST_OFFSET_MS);

const istTodayStart = (ms) => istDayStart(istDayKey(ms));

module.exports = { istDayKey, istDayStart, istTodayStart, IST_OFFSET_MS, DAY_MS };
