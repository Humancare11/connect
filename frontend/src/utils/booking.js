// src/utils/booking.js

export const BOOKING_PENDING_KEY = "hcc_booking_pending";
export const BOOKING_RESUME_KEY = "hcc_booking_resume_after_login";

export function readPendingBooking() {
  const raw = sessionStorage.getItem(BOOKING_PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function savePendingBooking(payload) {
  sessionStorage.setItem(BOOKING_PENDING_KEY, JSON.stringify(payload));
}

export function clearPendingBooking() {
  sessionStorage.removeItem(BOOKING_PENDING_KEY);
}

export function getClientTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function toAppointmentUtc(date, time) {
  if (!date || !time) return "";
  const match = String(time)
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return "";
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const localDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(localDate.getTime())) return "";
  localDate.setHours(hours, minutes, 0, 0);
  return localDate.toISOString();
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatPrice(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "";
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  })}`;
}