# Live Chat

Humancare Connect's own website chat: an AI agent first, live agents (admins and superadmins) behind it. It replaces the Text widget. Everything lives on the git branch `chat` until it is released.

Plan and decisions per phase: `docs/live-chat-plan.md`. Go-live steps: `docs/live-chat-go-live.md`. Privacy wording draft: `docs/live-chat-privacy-draft.md`. CSP review: `docs/live-chat-csp-review.md`. Design reference for the admin UI: `docs/live-chat-admin-ui.html` (a mock with fake data; the real UI follows it). The patient widget's reference is `docs/chat-demo.html`.

## Switches

| Switch | Where | Effect |
|---|---|---|
| `LIVECHAT_ENABLED` | backend env | Off (default): no sockets, no routes, no AI calls. Retention still runs. |
| `VITE_LIVECHAT_ENABLED` | frontend build env | On: our widget and the consent tracker are in the browser build and the Text widget is NOT rendered. Off: Text widget as before. |

Rollback: set both to `false`, rebuild the frontend, restart the backend. The Text widget returns at once (its package is still installed).

### What the flags change (flags off = the site as on main)

With `LIVECHAT_ENABLED` unset/false AND `VITE_LIVECHAT_ENABLED` unset/false: the Text widget is rendered, no live chat routes, sockets, widget, tracker or contact form exist, no site-wide cookie banner (only the old /cookies page), and no Live Chat item in the admin sidebar. Two small things are always present: the DB-IP attribution link in the footer, and a live chat row in the retention settings (nothing to delete while the module is off). Both flags must be changed together.

## Patient experience rules (local-testing round)

- There is no Online switch and no support hours. Whenever a chat goes to the team (header button, quick option, AI hand-over, a returning patient, a requeued chat) the patient always sees: "Thanks, {first name}! Connecting you to our team now. You can keep typing your question here." and the chat waits in the Queue.
- If no admin has replied after the follow-up time (AI agent settings, default 1 minute, 1 to 30), the patient sees "Our team will connect with you by email at {email} shortly." and ONE generic follow-up email goes out (no chat text, no symptoms, no reason; at most once per chat). The chat stays in the Queue with the label "Email follow-up" ("Email failed" if the email could not be sent) and an agent can still join. The step is cancelled when an admin takes the chat or replies, or the patient goes back to the AI. The due time is stored on the conversation (`followUpDueAt`) and a job (every 15 seconds, plus a sweep at startup) sends what is due, so it still happens after the patient leaves or the server restarts. A chat waiting for its notice is not archived when the patient leaves.
- Header status: "Humancare AI · Online" with the AI, "Connecting you with a live agent…" while waiting, "Message received" after the email notice.
- Header buttons: "Talk to live agent" is always there while with the AI. With a live agent (or while waiting) there is "Switch to AI": the chat goes back to the AI at once, the agent sees "Patient switched to the AI assistant", and a chat that was ever live stays in Live agent chats under "Back with the AI". Hidden when AI mode is "AI off".
- Page links: the AI can attach up to 3 buttons to a reply. The allowlist is `backend/data/liveChatSitePages.json`, built from `frontend/src/data/searchIndex.js` (categories, specialties, conditions) plus service pages and `/appointment-booking`, keeping only routes that are active in `App.jsx`. After changing routes or the taxonomy run `node backend/scripts/buildLiveChatSitePages.js` (a test fails if the file is out of date). The model is shown only the pages that fit the patient's words and the server drops any url not on the list; titles come from the list. Quick options can have a "Page button" (AI agent settings). Buttons use client-side routing, so the chat stays open on the next page (on a phone the window folds away so the page can be read).
- Scrolling: the site's smooth scroller (Lenis) swallows wheel events inside nested scroll areas unless the area carries `data-lenis-prevent`; the widget window and message area have it. Do not remove it.
- Turnstile uses appearance "interaction-only": nothing shows unless Cloudflare needs the person to act. The "Success! For testing only" box only comes from Cloudflare's test keys (the development fallback key); a real `VITE_TURNSTILE_SITE_KEY` never shows it.

## Translation for admins (AI chats and Live agent chats)

Admin side only: the patient never sees a badge, toggle or translation, and sees only the text that was sent to them.

- **Language.** The AI reply carries the language of the patient's latest message (no extra call); it is stored on the chat (`language`: code + name) and shown as a badge in the chat list and the conversation header (none for English). A different language later only replaces it when the patient's latest message is long enough to be sure. Chats with no AI turn (AI off, daily cap reached, straight to an agent) get one small detection call on the first clearly non-English patient message; clearly English or too-short messages skip it, it counts toward the cap, and with AI unavailable there is simply no badge.
- **English view.** Header toggle "Original (German) | English" (Original is the default; the choice is stored per admin per chat). English shows an English translation of every non-English patient, AI and agent message, with "Translated from German · show original"; new patient messages are translated as they arrive. Messages are translated in batches of up to 20 and cached on the message, encrypted like its text, so a message is never translated twice. English-looking text, internal notes, files and system lines are never sent to the model.
- **Reply translation.** In a chat with a detected language the composer button reads "To German"; in any other chat "Translate" opens a list of 16 languages (German, Spanish, French, Arabic, Hindi, Italian, Portuguese, Dutch, Turkish, Russian, Chinese, Japanese, Korean, Polish, Urdu, Bengali) and the button then reads "To <language>". The translation goes in the box (editable) with "Your English: …" and "Undo translation" above it; nothing is sent automatically. A sent message stores both the text the patient received and the admin's English source (`sourceText`, encrypted), and admins see the English source under it. Internal notes have no translate button. Saved replies can be translated the same way.
- **Model call.** Same provider and `LIVECHAT_MODEL`. Only message text is sent (no chat id, no contact fields). The patient's name, email and phone, links, site paths, prices and email addresses are replaced by placeholders before and restored after (a result that loses one is discarded), so the patient's details never reach the model. Cost counts toward the daily cap; when the cap is reached or AI is unavailable the admin sees "Translation unavailable right now" and everything else keeps working. Rate limit: 30 translation requests per minute per admin.
- **API** (admin + superadmin): `POST /conversations/:id/translate` ({ messageIds? }), `POST /conversations/:id/translate-reply` ({ text, target? } where `target` is a language code from the fixed list; anything else is a 400), `PUT /conversations/:id/view` ({ view }), and `sourceText` on `POST /conversations/:id/messages`.

## Location (GeoIP) and the real client IP

- Location comes from the free DB-IP "IP to City Lite" file, never a web service. Download https://db-ip.com/db/download/ip-to-city-lite (monthly `.mmdb.gz`, direct form `https://download.db-ip.com/free/dbip-city-lite-YYYY-MM.mmdb.gz`), unzip, and save as `backend/data/dbip-city-lite.mmdb` (git-ignored) or set `GEOIP_DB_PATH`. Production: put the same file on the server and set `GEOIP_DB_PATH` to it; replacing the file is picked up without a restart. A clear warning is logged at startup when it is missing.
- On localhost the IP is `::1` / `127.0.0.1`, which has no location. Development only: set `LIVECHAT_DEV_FAKE_IP=<a real public IP>` in `backend/.env` (ignored when `NODE_ENV=production` and when the value is not a public address; a warning shows at startup when it is active).
- Behind Render/Nginx the visitor's address is read from `X-Forwarded-For` according to `TRUST_PROXY` (default 1 hop; use 2 for Cloudflare/Render + Nginx; `false` when nothing is in front). `CF-Connecting-IP` is only used with `USE_CLOUDFLARE_HEADERS=true`.

## Who can do what

- Agents are users with role `admin` or `superadmin`. `employeeadmin` and `partner` are not agents.
- Superadmin edits AI settings, saved replies, patient context fields and anyone's display name. Admin views settings and edits only their own display name.
- Socket namespaces `/livechat` (patients) and `/livechat-admin` (agents, role checked on connect and on every event, session re-checked periodically).

## Admin UI (its own browser tab)

The Live Chat admin is a separate dashboard, built from `docs/live-chat-admin-ui.html`, that opens in its own browser tab. All other admin pages keep `AdminLayout` unchanged.

**Opening it and the tab rules**

- The old admin sidebar has one "Live Chat" item (NEW badge plus the unread count). A plain click opens `/admin-dashboard/live-chat` in the tab named `humancare-livechat` and re-uses that tab if it is already open (a chat deep link moves the open tab to that chat without a reload). Middle-click and Ctrl-click use the normal new-tab behaviour of the link. `window.open` is called without `noopener` on purpose: with it the named tab cannot be found again and every click would open a new tab; the link itself keeps `rel="noopener noreferrer"`.
- The Live Chat tab tells the other admin tabs it is open (heartbeat every 5 s, "closed" on exit). While it is open only that tab plays the sound and shows toasts and browser notifications; the dashboard tab only updates its badge. If it is closed, the dashboard tab alerts as before. Messages travel over `BroadcastChannel`, with a `localStorage` + `storage` event fallback (`frontend/src/utils/crossTab.js`, `pages/admin/livechat/liveChatTabs.js`).
- One admin session, two tabs. Signing out in one tab signs out the other at once. Real user input in either tab (throttled to once per 20 s) resets the idle timeout of the other, so working only in the Live Chat tab does not log the admin out. Sign-out clears local storage except the Live Chat theme and sound choices.

**Shell** (`LiveChatShell.jsx`): the Live Chat menu (Admin dashboard, Real-time visitors, AI chats, Live agent chats, Team, Reports, AI agent settings, Collapse, Sign Out) with unread badges, a top bar and a Light/Dark toggle (dark by default, remembered per browser). The menu collapses by itself on the chat pages. Sign Out uses the existing admin logout. Geist is loaded from Google Fonts only while a Live Chat page is open. All styling is scoped under `.lcx` (`livechat-ui.css` is generated from the design file; `livechat-extra.css` holds the additions), so nothing leaks to other admin pages.

**Real-time visitors**: the table (name, email, activity, Start chat / View chat / Join, edit pencil, teammate, time on all pages, country, state). Visitors waiting for an agent are pinned to the top. The Care radar flags a patient who has been on the booking page for 4 minutes without booking. The right panel shows contact details, location, their local time, chat / ticket / visit counts, First or Returning visit, Qualification (Save contact), Patient context, Visited pages, Recent conversations and Visit info (with Block IP). Blocked IPs are listed at the bottom.

**AI chats and Live agent chats**: a chat list with groups (Queue, My chats, Other agents, Back with the AI, Archived; Talking to the AI on the AI page), counts, collapse and an Oldest/Newest sort per group; a conversation with AI, agent and patient bubbles, system lines and internal notes; a details panel (Qualification, Patient context, Chat info, Chat tags, Recent conversations, Visited pages, Visit info). Queue chats keep their handoff reason and the "Email follow-up" / "Email failed" labels. Header actions: Take over chat, Hand back to AI, Resolve, add an internal note, download the transcript, copy the chat link, show/hide the details panel and a "…" menu with Block IP.

**Composer**: Message / Internal note (notes are for the team and never reach the patient); Translate (see above); Saved replies (click `#`, or type `#` and keep typing to filter; arrow keys and Enter pick one; one shared list that a Super Admin manages in AI agent settings, `{agentName}` is filled in); "Suggest a reply with AI" (puts a draft in the box, nothing is sent until the admin edits and sends it); emoji; attach a file; Enter sends, Shift+Enter starts a new line.

**Transcript download**: `GET /conversations/:id/transcript` returns plain text (`chat-<chat id>.txt`, never the patient's name, `Cache-Control: no-store`). Internal notes and team-only lines are left out. Each download is recorded on the chat (`transcriptLog`: admin and time, last 50) and deleted with the chat.

**Files sent to a patient**: the paperclip/plus button sends a PDF, JPG or PNG (10 MB) to the patient (`POST /conversations/:id/files`). It follows the rules of a reply: only the assignee can send, sending takes over a chat that is with the AI or in the Queue, a closed chat refuses. Stored exactly like a patient upload (random key `livechat/<chat>/<uuid>.<ext>`, no file name in S3, name encrypted in MongoDB, same real-type check, same per-chat file limit, a per-admin rate limit). The patient's widget shows the file with an Open button; the patient gets a 5-minute link from `GET /api/livechat/files/:id/url` (chat token required, only files the team sent them in their own chat, `Cache-Control: no-store`, each open logged in `patientAccessLog`). Retention deletes agent files from S3 and the database with the rest of the chat.

**Patient context**: Follow-up date, Preferred language, Contact preference, Reason for contact, plus up to 10 text fields a Super Admin defines in AI agent settings. Free text (200 characters), stored encrypted on the visitor record (`LcVisitor.context`), saved when the box loses focus, shared by every chat of that patient and removed by retention with the visitor. API: `PUT /visitors/:visitorId/context`; the fields and field definitions come with `GET /visitors/:visitorId/panel` and the chat detail.

**Tell me about this patient**: an on-demand AI summary of the chat (2 to 4 sentences), made when the button is clicked and never saved (`POST /conversations/:id/summary`, `POST /visitors/:visitorId/summary`; a visitor with no chat has nothing to summarize). Only the chat text is sent: the patient's name, email and phone are replaced by `[name]`, `[email]` and `[phone]` first; no contact fields, ids, file names or internal notes. It counts toward the daily AI cap (refused once reached) and is rate-limited to 10 per minute per admin.

**Suggest a reply** uses the same redaction as the summary before the chat history goes to the model.

**Team**: role, name patients see, open chats, chats today, average first reply, AI row.

**Reports**: chats today, % solved by AI, first reply time, rating, bookings after chat (patient email matched to a booking made within 7 days after the chat), AI cost today and this month, chats per hour (AI vs agent), date range filter (max 366 days, days counted in America/New_York).

**AI agent settings**: AI mode (AI first / AI off), handoff rules, the follow-up time, greeting and messages, quick options, business facts, prices, default agent name, daily AI cap, grace seconds, saved replies, patient context fields, and a change log (who, what, when). Only a Super Admin saves; admins see it read only. A save is validated as a whole, applies without a restart and is written to `LcSettingsAudit`. (Saved replies were called canned replies before; their API paths and change-log field names keep the old name.)

## Data and privacy

- Chat content, names, emails, phones and file names are encrypted (AES-256-GCM) with `LIVECHAT_ENCRYPTION_KEY`, a key separate from the existing chat key. Lose the key and the data is unreadable: back it up.
- Message text, emails and phone numbers are never logged. OpenAI request and response bodies and the API key are never logged.
- Files (pdf, jpg, png, 10 MB) go to S3 under `livechat/`, opened only through a role-checked 5-minute presigned URL. Files an agent sends to a patient are stored the same way and the patient opens them through a 5-minute link limited to their own chat; every open is logged.
- Anything sent to OpenAI by the admin tools (Suggest a reply, Tell me about this patient, translation) has the patient's name, email and phone removed first, never includes contact fields, ids, file names or internal notes, and counts toward the daily AI cap.
- Transcript downloads are logged on the chat (admin and time). Patient context fields are stored encrypted on the visitor record and deleted by retention.
- Emails (the follow-up email) carry no health details.

## Retention

`RetentionPolicy` key `liveChat`, default 365 days (editable on the existing retention page). The nightly retention job deletes, per old chat: S3 objects first (rows stay if a file could not be deleted and are retried next run), then files, messages, the chat, old page visits and contacts with no remaining chats. AI usage totals (`LcAiUsage`) are kept for cost history. It runs even when `LIVECHAT_ENABLED=false`. The existing `ChatMessage` retention is untouched.

## Tests

`cd backend && npm test` (or `node --test --test-concurrency=2 "tests/liveChat*.test.js"` for the live chat suites only). The admin UI work added `liveChatVisitorPanel`, `liveChatTranscript`, `liveChatComposer` (Suggest redaction, Translate targets, files sent to patients) and `liveChatContext` (patient context, custom fields, AI summary); the settings, reports and retention suites cover Phase 5 and the retention of agent-sent files.

## Text widget removal (after go-live and a quiet period)

1. `frontend/src/App.jsx`: delete the `TextWidget` import and its conditional render.
2. `npm uninstall @livechat/widget-react` in `frontend/`.
3. Remove any LiveChat/Text domains from the CSP proposal and from the privacy and cookie wording.
4. Delete the `VITE_LIVECHAT_ENABLED` branching once the flag is permanently true.
