import useVisitorTracker from "./useVisitorTracker";

// Mounted once in AppLayout. Renders nothing; reports presence for visitors who accepted cookies.
export default function LiveChatTracker() {
  useVisitorTracker();
  return null;
}
