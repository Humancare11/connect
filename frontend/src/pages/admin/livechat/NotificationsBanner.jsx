import { useEffect, useState } from "react";
import {
  bannerDismissed,
  dismissBanner,
  installAudioUnlock,
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
  setSoundEnabled,
  setVisitorSoundEnabled,
  soundEnabled,
  visitorSoundEnabled,
} from "./liveChatNotify";
import "./LiveChatToasts.css";

// "Never miss a patient chat" (docs/live-chat-admin-ui.html .banner): asks the admin to allow browser notifications, and
// offers a sound on/off switch. Browser notifications are only ever turned on by the admin's own click.
export default function NotificationsBanner() {
  const [permission, setPermission] = useState(notificationPermission);
  const [dismissed, setDismissed] = useState(bannerDismissed);
  const [sound, setSound] = useState(soundEnabled);
  const [visitorSound, setVisitorSound] = useState(visitorSoundEnabled);

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
      <button
        type="button"
        className="lcn-sound"
        aria-pressed={sound}
        title={sound ? "Sound is on for new chats and messages" : "Sound is off"}
        onClick={() => {
          setSoundEnabled(!sound);
          setSound(!sound);
        }}
      >
        {sound ? "🔔 Sound on" : "🔕 Sound off"}
      </button>
      <button
        type="button"
        className="lcn-sound"
        aria-pressed={visitorSound}
        title={
          visitorSound
            ? sound
              ? "A soft sound plays when a new visitor arrives (Live Chat tab only)"
              : "On, but silent while Sound is off"
            : "No sound for new website visitors"
        }
        onClick={() => {
          setVisitorSoundEnabled(!visitorSound);
          setVisitorSound(!visitorSound);
        }}
      >
        {visitorSound ? "👤 Visitor sound on" : "👤 Visitor sound off"}
      </button>
    </div>
  );
}
