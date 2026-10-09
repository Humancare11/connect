import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { hub } from "./liveChatHub";
import LiveChatToasts from "./LiveChatToasts";
import { useLiveChatAdmin } from "./useLiveChatAdmin";

const AGENT_ROLES = ["admin", "superadmin"];

// Mounted once in AdminLayout for admins and superadmins: keeps the connection open on every admin page, so unread
// badges and toasts work everywhere, and renders the toasts. Renders nothing when the module is off.
export function LiveChatAdminProvider({ user }) {
  const navigate = useNavigate();
  const { toasts, status } = useLiveChatAdmin();
  const allowed = hub.enabled && user && AGENT_ROLES.includes(user.role);
  const userId = user ? String(user._id || user.id || "") : "";

  useEffect(() => {
    if (!allowed) return undefined;
    return hub.acquire(userId);
  }, [allowed, userId]);

  if (!allowed || status === "off" || !toasts.length) return null;

  return (
    <LiveChatToasts
      toasts={toasts}
      onOpen={(toast) => {
        hub.dismissToast(toast.id);
        if (toast.path) navigate(toast.path);
      }}
    />
  );
}
