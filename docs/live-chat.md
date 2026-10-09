# Live Chat

Humancare Connect's own website chat: an AI agent first, live agents (admins and superadmins) behind it. It replaces the Text widget. Everything lives on the git branch `chat` until it is released.

Plan and decisions per phase: `docs/live-chat-plan.md`. Go-live steps: `docs/live-chat-go-live.md`. Privacy wording draft: `docs/live-chat-privacy-draft.md`. CSP review: `docs/live-chat-csp-review.md`. Design reference: `docs/chat-demo.html`.

## Switches

| Switch | Where | Effect |
|---|---|---|
| `LIVECHAT_ENABLED` | backend env | Off (default): no sockets, no routes, no AI calls. Retention still runs. |
| `VITE_LIVECHAT_ENABLED` | frontend build env | On: our widget and the consent tracker are in the browser build and the Text widget is NOT rendered. Off: Text widget as before. |

Rollback: set both to `false`, rebuild the frontend, restart the backend. The Text widget returns at once (its package is still installed).

### What the flags change (flags off = the site as on main)

With `LIVECHAT_ENABLED` unset/false AND `VITE_LIVECHAT_ENABLED` unset/false: the Text widget is rendered, no live chat routes, sockets, widget, tracker or contact form exist, no site-wide cookie banner (only the old /cookies page), and no Live Chat group in the admin sidebar. Two small things are always present: the DB-IP attribution link in the footer, and a live chat row in the retention settings (nothing to delete while the module is off). Both flags must be changed together.

## Patient experience rules (local-testing round)

- The patient is never told the team is "offline" and never sees support hours. With no agent available the chat shows: "Thanks, {first name}! We've received your question and details. Our team will get back to you at {email} shortly." (setting "Message when no agent is available", placeholders `{firstName}` and `{email}`; the two older "team is offline" defaults are replaced automatically). One follow-up email goes out with no hours and no health details; admins still see the request in the Queue. Header status: "Humancare AI · Online" with the AI, "Message received" after the thank-you.
- Header buttons: "Talk to live agent" is always there while with the AI. With a live agent (or while waiting) there is "Switch to AI": the chat goes back to the AI at once, the agent sees "Patient switched to the AI assistant", and a chat that was ever live stays in Live agent chats under "Back with the AI". Hidden when AI mode is "AI off".
- Page links: the AI can attach up to 3 buttons to a reply. The allowlist is `backend/data/liveChatSitePages.json`, built from `frontend/src/data/searchIndex.js` (categories, specialties, conditions) plus service pages and `/appointment-booking`, keeping only routes that are active in `App.jsx`. After changing routes or the taxonomy run `node backend/scripts/buildLiveChatSitePages.js` (a test fails if the file is out of date). The model is shown only the pages that fit the patient's words and the server drops any url not on the list; titles come from the list. Quick options can have a "Page button" (AI agent settings). Buttons use client-side routing, so the chat stays open on the next page (on a phone the window folds away so the page can be read).
- Scrolling: the site's smooth scroller (Lenis) swallows wheel events inside nested scroll areas unless the area carries `data-lenis-prevent`; the widget window and message area have it. Do not remove it.
- Turnstile uses appearance "interaction-only": nothing shows unless Cloudflare needs the person to act. The "Success! For testing only" box only comes from Cloudflare's test keys (the development fallback key); a real `VITE_TURNSTILE_SITE_KEY` never shows it.

## Location (GeoIP) and the real client IP

- Location comes from the free DB-IP "IP to City Lite" file, never a web service. Download https://db-ip.com/db/download/ip-to-city-lite (monthly `.mmdb.gz`, direct form `https://download.db-ip.com/free/dbip-city-lite-YYYY-MM.mmdb.gz`), unzip, and save as `backend/data/dbip-city-lite.mmdb` (git-ignored) or set `GEOIP_DB_PATH`. Production: put the same file on the server and set `GEOIP_DB_PATH` to it; replacing the file is picked up without a restart. A clear warning is logged at startup when it is missing.
- On localhost the IP is `::1` / `127.0.0.1`, which has no location. Development only: set `LIVECHAT_DEV_FAKE_IP=<a real public IP>` in `backend/.env` (ignored when `NODE_ENV=production` and when the value is not a public address; a warning shows at startup when it is active).
- Behind Render/Nginx the visitor's address is read from `X-Forwarded-For` according to `TRUST_PROXY` (default 1 hop; use 2 for Cloudflare/Render + Nginx; `false` when nothing is in front). `CF-Connecting-IP` is only used with `USE_CLOUDFLARE_HEADERS=true`.

## Who can do what

- Agents are users with role `admin` or `superadmin`. `employeeadmin` and `partner` are not agents.
- Superadmin edits AI settings, canned replies and anyone's display name. Admin views settings and edits only their own display name.
- Socket namespaces `/livechat` (patients) and `/livechat-admin` (agents, role checked on connect and on every event, session re-checked periodically).

## Admin pages (sidebar group "Live Chat")

- Real-time visitors, AI chats, Live agent chats (Phases 1 to 4).
- **Team**: role, name patients see, status, open chats, chats today, average first reply, AI row.
- **Reports**: chats today, % solved by AI, first reply time, rating, bookings after chat (patient email matched to a booking made within 7 days after the chat), AI cost today and this month, chats per hour (AI vs agent), date range filter (max 366 days, in the support time zone).
- **AI agent settings**: AI mode, handoff rules, support hours and time zone, offline rule, greeting and messages, quick options, business facts, prices, default agent name, daily AI cap, grace seconds, canned replies, and a change log (who, what, when). A save is validated as a whole, applies without a restart and is written to `LcSettingsAudit`.

## Data and privacy

- Chat content, names, emails, phones and file names are encrypted (AES-256-GCM) with `LIVECHAT_ENCRYPTION_KEY`, a key separate from the existing chat key. Lose the key and the data is unreadable: back it up.
- Message text, emails and phone numbers are never logged. OpenAI request and response bodies and the API key are never logged.
- Files (pdf, jpg, png, 10 MB) go to S3 under `livechat/`, opened only through a role-checked 5-minute presigned URL.
- Emails (offline follow-up) carry no health details.

## Retention

`RetentionPolicy` key `liveChat`, default 365 days (editable on the existing retention page). The nightly retention job deletes, per old chat: S3 objects first (rows stay if a file could not be deleted and are retried next run), then files, messages, the chat, old page visits and contacts with no remaining chats. AI usage totals (`LcAiUsage`) are kept for cost history. It runs even when `LIVECHAT_ENABLED=false`. The existing `ChatMessage` retention is untouched.

## Tests

`cd backend && npm test`. Live chat suites: `liveChat*.test.js`. The settings, reports and retention suites cover Phase 5.

## Text widget removal (after go-live and a quiet period)

1. `frontend/src/App.jsx`: delete the `TextWidget` import and its conditional render.
2. `npm uninstall @livechat/widget-react` in `frontend/`.
3. Remove any LiveChat/Text domains from the CSP proposal and from the privacy and cookie wording.
4. Delete the `VITE_LIVECHAT_ENABLED` branching once the flag is permanently true.
