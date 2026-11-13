/* eslint-disable react-refresh/only-export-components */
// Entry for the UI tests: React, the server renderer and the components, bundled together into ONE file so they share one copy of React.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
export { React, renderToStaticMarkup };
export * as buttons from "../../src/features/translation/ControlButtons.jsx";
export * as language from "../../src/features/translation/LanguagePanel.jsx";
export * as transcript from "../../src/features/translation/TranscriptPanel.jsx";
export * as overlay from "../../src/features/translation/TranscriptionOverlay.jsx";
export * as viewer from "../../src/features/translation/TranscriptViewer.jsx";
export * as unreadableCard from "../../src/components/UnreadableRecordCard.jsx";
