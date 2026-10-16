import ChatWorkspace from "./ChatWorkspace";

// Live Chat > AI chats: patients talking only to the AI. Reply or "Take over" moves a chat to Live agent chats.
export default function AdminAiChats() {
  return <ChatWorkspace view="ai" />;
}
