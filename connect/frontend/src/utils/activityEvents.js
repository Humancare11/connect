export const USER_ACTIVITY_UPDATED_EVENT = "user-activity-updated";

export function notifyUserActivityUpdated(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(USER_ACTIVITY_UPDATED_EVENT, {
      detail,
    })
  );
}
