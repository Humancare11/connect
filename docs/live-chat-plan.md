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
