// Date/time helpers shared by booking and rescheduling (moved out of appointmentController unchanged).

function timeToMinutes(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// Convert a date + time string (in the patient's local timezone) to a UTC Date.
// Uses the Intl API so DST and non-integer offsets (e.g. IST +5:30) are handled correctly.
// Falls back to treating the time as UTC when the timezone is unknown/invalid.
function buildUtcDateTime(date, time, timezone) {
  if (!date || !time) return null;
  const minutes = timeToMinutes(time);
  if (minutes === null) return null;
  const hours = Math.floor(minutes / 60);
  const mins  = minutes % 60;

  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;

  if (timezone) {
    try {
      // Create a UTC epoch at the same clock values as the desired local time.
      const utcEstimate = new Date(Date.UTC(year, month - 1, day, hours, mins, 0, 0));

      // Format that UTC instant in the patient's timezone to see what local clock it shows.
      const localStr = utcEstimate.toLocaleString("en-US", {
        timeZone: timezone,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      });

      // Parse the local clock back as if it were UTC to get the raw millisecond offset.
      const localAsUtc = new Date(localStr + " UTC");
      if (Number.isNaN(localAsUtc.getTime())) throw new Error("parse failed");

      // offsetMs = how far ahead/behind the timezone is from UTC.
      // actual UTC = utcEstimate + offsetMs
      const offsetMs = utcEstimate.getTime() - localAsUtc.getTime();
      return new Date(utcEstimate.getTime() + offsetMs);
    } catch {
      // Fall through to UTC fallback below.
    }
  }

  // Fallback: treat the time as UTC (legacy behaviour, no timezone info available).
  return new Date(Date.UTC(year, month - 1, day, hours, mins, 0, 0));
}

module.exports = { timeToMinutes, buildUtcDateTime };
