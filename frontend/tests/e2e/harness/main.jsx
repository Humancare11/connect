// Test harness: mounts only the patient chat widget (no app, no backend). Used by liveChatWidget.e2e.test.mjs.
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import LiveChatWidget from "../../../src/features/livechat/LiveChatWidget";

createRoot(document.getElementById("root")).render(
  <MemoryRouter>
    <LiveChatWidget configAiName="Connect AI" showAiNotice={false} />
  </MemoryRouter>
);
