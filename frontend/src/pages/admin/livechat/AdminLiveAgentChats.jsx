import ChatWorkspace from "./ChatWorkspace";

// Live Chat > Live agent chats: Queue, My chats, Archived. A chat that was ever live stays here.
export default function AdminLiveAgentChats() {
  return <ChatWorkspace view="live" />;
}
