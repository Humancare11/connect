import { useEffect, useState, useSyncExternalStore } from "react";
import {
  bannerDismissed,
  dismissBanner,
  installAudioUnlock,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  audioUnlocked,
  subscribeAudioState,
} from "./liveChatNotify";
import "./LiveChatToasts.css";

// "Never miss a patient chat" (docs/live-chat-admin-ui.html .banner): asks the admin to allow browser notifications, and
// says when a click is needed to enable sound. The sound and voice alerts are always on: there is no mute. Browser
// notifications are only ever turned on by the admin's own click.
export default function NotificationsBanner() {
  const [permission, setPermission] = useState(notificationPermission);
  const [dismissed, setDismissed] = useState(bannerDismissed);

  const unlocked = useSyncExternalStore(subscribeAudioState, audioUnlocked);
  useEffect(() => {
    installAudioUnlock();
  }, []);

  const showAsk = notificationsSupported() && permission === "default" && !dismissed;

  return (
    <div className="lcn-bar">
      {showAsk && (
        <div className="lcn-banner" role="region" aria-label="Notifications">
          <span>🔔 Never miss a patient chat.</span>
          <button type="button" onClick={async () => setPermission(await requestNotificationPermission())}>
            Turn on notifications
          </button>
          <button
            type="button"
            className="lcn-x"
            aria-label="Dismiss"
            onClick={() => {
              dismissBanner();
              setDismissed(true);
            }}
          >
            ✕
          </button>
        </div>
      )}
      {!unlocked && (
        <span className="lcn-hint" role="status">
          🔈 Click anywhere on this page to enable sound
        </span>
      )}
    </div>
  );
}
