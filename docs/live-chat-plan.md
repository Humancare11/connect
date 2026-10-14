# Live Chat module: approved plan

This is the approved implementation plan, with the owner's answers and corrections applied. Read it, together with `docs/live-chat-brief.md`, at the start of every phase. Where the two disagree, this plan wins.

## Working rules (every phase)
- Work only on git branch `chat`. Never commit, merge or push to main/master. Never deploy.
- Before each phase, list the files to add or change and wait for the owner's OK.
- Follow existing conventions. New secrets go only in `backend/.env.example` as placeholders. `backend/.env` is git-ignored and must never be committed.
- At the end of a phase: run the app and the tests, commit on `chat` as `live-chat: phase N - <summary>`, then report what changed, which existing files were touched, how to test, and what the owner must do (env vars, keys).
- UI source of truth: `docs/chat-demo.html`.

## Decisions and corrections
- Live agents are `admin` and `superadmin` only. `employeeadmin` is NOT an agent.
- Backend instance count is unknown. Presence stays in memory behind a small store interface (`services/liveChat/presence.js`), so a Socket.IO Redis adapter and a shared store can be added later without a rewrite.
- Bot protection: Cloudflare Turnstile. The owner creates the keys; `.env.example` holds placeholders.
- Support hours default: 08:00-22:00, America/New_York, every day, editable in AI settings. The team counts as offline when outside hours OR no agent is online.
- Offline follow-up email: sent from support@humancareconnect.co through the existing Email module. No health details in the email.
- Model: `gpt-6-luna` is allowed in the owner's OpenAI project. Keep provider and model configurable. If the model call fails for any reason, use the same AI-unavailable fallback.
- Encryption: do NOT change `chatCrypto.js` and do NOT require `CHAT_ENCRYPTION_KEY`. Doing so could make existing doctor-patient messages unreadable. Live-chat data uses its own `LIVECHAT_ENCRYPTION_KEY`. When `LIVECHAT_ENABLED=true` in production, the key is required and the live-chat module refuses to start without it (the rest of the app still starts).
- Page timelines (`LcPageVisit`) are stored only for visitors who start a chat. Visitors who never chat stay in memory only, even if they accepted cookies.
- The typing event carries no text, only `typing: true/false`.
- `LIVECHAT_ENABLED` (default `false`) is a kill switch for the whole module, backend and widget.
- `backend/.env` is git-ignored and never committed. Real keys stay out of the repo.

## Phase 2 decisions (approved)
- Cookie banner: mounted site-wide on public pages (not admin, login, payment, patient dashboard, video-call), client-side only; the dead `loadLiveChat()` call is removed; the banner dispatches `hc:cookie-consent` so the tracker reacts without polling.
- The Text widget is not rendered when `VITE_LIVECHAT_ENABLED=true` (removed for good in Phase 5).
- No streaming: the reply is structured JSON and the server decides on handoff before anything is shown.
- Emergency: if the patient describes an emergency, the AI tells them to call 911 and hands off to a live agent. No emergency banner or box in the widget UI.
- gpt-6-luna prices (USD per 1M tokens, context under 272K): input 0.10, cached input 0.01, output 0.50. `LIVECHAT_REASONING_EFFORT` defaults to `none`, the lowest value the model accepts (it rejects `minimal`). Empty or incomplete output shows the unavailable fallback.
- Chat works without cookie consent (functional); presence tracking still needs consent.
- Quick-option clicks reply with the configured topic text (no AI call).
- Offline / outside hours: the patient is told and the request is saved in the queue (`offlineRequested`). The email follow-up and the "alert admins once" notice are Phase 4.

## Phase 3 decisions (approved)
- AI chats = chats that were never live. Any admin reply or "Take over" moves a chat to Live agent chats, where it stays for good (Queue, My chats, Other agents' chats, Back with the AI, Archived).
- One agent per chat: taking over is a single conditional update, so when two admins act at once only one wins and the other gets a 409 naming the winner. Only the assignee replies; other admins can read and add internal notes.
- A superadmin can take over a chat another agent holds (admins cannot). A system line "Super Admin took over from Sam" is shown to the team only; the patient sees "Super Admin joined the chat". The previous agent gets a toast.
- The patient sees the agent's display name ("Sam joined the chat", header, message labels).
- Internal notes and team-only system lines never reach the patient or the AI.
- Typing is a boolean in both directions, never text.
- Unread is per admin (a read marker per chat); badges on "AI chats" and "Live agent chats"; in-app toasts for new chats, patient messages and queue entries. Sound and browser notifications are Phase 4.
- Matching tickets: the contact's email is matched to a registered user; no match shows 0.
- Summary in Customer context is a plain factual summary (counts and state), not an AI summary.
- Page timeline (`LcPageVisit`) is saved only for visitors who chat, including pages seen before the chat started.
- The admin socket connection is shared for the whole admin session and only connects when `VITE_LIVECHAT_ENABLED=true`.
- "Start chat" on Real-time visitors works for visitors who already gave contact details; invites for brand-new visitors are Phase 4.

## Phase 4 decisions (approved)
- Files: pdf, jpg, png, max 10 MB, max 10 per chat, 5 uploads per 10 minutes per visitor. The real type is read from the bytes (file-type) and must match the extension. Stored in S3 under `livechat/<conversationId>/<random>.<ext>` with server-side encryption; the file name is kept encrypted in MongoDB only (never in S3 metadata, never given to the AI). Admins open a file only through a role-checked endpoint that returns a 5-minute presigned URL; every issue is logged on the file (who, when). The tab is opened on the click and its opener cleared.
- Rating: 1-5 stars once after Resolve (also for 24 hours after, if the patient moved on); saved on the chat and shown to admins (list, header, panel) with a team-only line.
- Admin-started chat with a visitor who has not opened the widget: "Start chat" creates an invited chat; once the admin writes, the visitor gets a bubble above the launcher with only "{agent} from Humancare support sent you a message" (Reply / Later). The message text is revealed after the contact form. Later hides it for the session. The visitor's contact details attach to the same chat.
- Offline (outside hours or no agent online): the patient is told, the request is saved in the Queue, and ONE email goes from the support mailbox (`LIVECHAT_FOLLOWUP_MAILBOX`, default support@humancareconnect.co) to the contact's own address through the Email module. No health details: only first name, chat reference and the support hours, which are read from LcSettings (never hard-coded). A failed send never breaks the chat and its error is not logged with the address.
- AI unavailable (credits/quota, any model error, bad output, daily cap): the same friendly notice, live chat keeps working, admins get ONE alert per outage (toast names the cause).
- Agent offline / logged out: after `handoffRules.agentOfflineGraceSeconds` (default 120, editable in Phase 5) their open chats return to the Queue and the patient is told they are being reconnected; if nobody else is online it becomes an offline request with the email. A revoked session is noticed by a once-a-minute session check.
- Visitor left: about 30 s after the last connection (tracker or chat) closes, an open chat is archived as "patient left". An offline request is not archived. A returning visitor within 24 hours is recognised and the chat continues: an AI chat goes back to the AI, a chat that had an agent goes back to the Queue. Resolved chats are never reopened.
- Notifications: a generated chime (mute switch) and browser notifications only after the admin clicks "Turn on notifications" and the browser allows it. Browser notifications show the patient's first name and the kind of event, never message text, and only while the tab is hidden.
- IP block: Block IP in the conversation header and on visitor rows. Blocks last until an admin unblocks them (Blocked IPs panel on Real-time visitors). A blocked IP cannot connect, post the contact form or upload; its open chats are closed as "Blocked". One abuse alert when an IP or a visitor starts 3 chats within an hour (`LIVECHAT_ABUSE_CHATS_PER_HOUR`) or hits the daily new-chat limit.
- Not done in Phase 4: a real upload/presign/delete round-trip against the S3 bucket (the owner's answer was left open; the fake store is used in tests).

## Phase 5 decisions (approved)
- Superadmin edits AI settings; admins view only. Each agent edits their own display name; a superadmin edits anyone's.
- Bookings after chat: patient email matched to a booking made within 7 days after the chat.
- Retention: RetentionPolicy key liveChat, 12 months, S3 objects first; AI usage totals kept; runs even when the module is off; ChatMessage retention untouched.
- /services-prices is NOT changed in this branch; two checks added to the go-live checklist.
- Real S3 check skipped; to be tested on staging (go-live checklist).
- CSP: report-only proposal in docs/live-chat-csp-review.md, no site-wide change. Privacy wording is draft only (docs/live-chat-privacy-draft.md). DB-IP attribution link added to the footer.
- Text widget stays out whenever VITE_LIVECHAT_ENABLED=true; removal steps in docs/live-chat.md.

## Models (`backend/models/`)
`LcVisitor`, `LcConversation`, `LcMessage`, `LcFile`, `LcPageVisit`, `LcAgentProfile`, `LcSettings` (seeded defaults), `LcAiUsage`, `LcBlockedIp`, `LcCannedReply`. All PHI fields are encrypted with the live-chat key.

## API
- Public (rate-limited), Phase 2+: session, contact, config, upload, rating.
- Admin, `/api/admin/livechat/*`, guarded by `verifyAdminToken` + `liveChatAgentOnly` (admin and superadmin only).

## Sockets
- `/livechat` (visitors): first-party visitor id, cookie-consent tracking, per-IP connection cap, event size limits, rate limits.
- `/livechat-admin` (agents): cookie/handshake JWT, role checked on connect and again on every event, session re-validated periodically, per-IP connection cap, event size limits.
- Presence: in-memory registry with a 30 s grace period after the last socket of a visitor disconnects.

## Frontend
- Patient widget under `frontend/src/features/livechat/`, public pages only, mounted client-side after idle.
- Consent tracker runs only when `localStorage.cookieConsent === "accepted"`.
- Admin pages under `frontend/src/pages/admin/livechat/`, in a "Live Chat" sidebar group with a NEW badge.

## Phases
1. Foundation: kill switch, key check, models, sockets, presence, consent tracker, sidebar group, Real-time visitors page, tests.
2. Patient widget, contact form, quick options, header live-agent button, AI, abuse limits.
3. Admin chat workspace: AI chats, Live agent chats, patient panel.
4. Files, rating, admin-started chats, offline and AI-unavailable fallbacks, visitor-left, notifications.
5. Team, Reports, AI settings, retention, privacy lines, docs (`docs/live-chat.md`), tests, Text widget removal.

## Tests (`node --test`)
Contact form gate, option click flow, AI chats moving to Live agent chats, visitor leaving archives the chat, admin-only access on routes and sockets, credit-exhausted fallback, rate limits. Phase 1 adds: admin-only access, visitor removed about 30 s after disconnect, module fully off when `LIVECHAT_ENABLED=false`.

## Go-live reminders
- Sign a BAA with OpenAI. Confirm existing BAAs for AWS, MongoDB hosting and the email provider.
- Check production admin accounts.
- Set `LIVECHAT_ENCRYPTION_KEY`, Turnstile keys and `LIVECHAT_OPENAI_API_KEY` in production.

## Risks
- Prerender: the widget must stay client-only and lazy.
- Multiple backend instances: in-memory presence needs a shared store (see decisions).
- Prepaid AI credits will run out eventually; the fallback is designed for it.
- The existing retention job deletes `ChatMessage` by age. Live-chat retention must stay separate and must not touch it.
