// A prescription or certificate the server could not decrypt comes back with `unreadable: true` (and null protected fields) instead of
// failing the whole list. The screens show this text in its place and do not offer to open or download it.
export const UNREADABLE_RECORD_TEXT = "This record can't be displayed right now. Please contact support.";
export const isUnreadableRecord = (record) => Boolean(record && record.unreadable === true);
export const recordTitle = (record) => (isUnreadableRecord(record) ? UNREADABLE_RECORD_TEXT : record?.diagnosis);
