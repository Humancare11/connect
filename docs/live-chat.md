# Live Chat

Humancare Connect's own website chat: an AI agent first, live agents (admins and superadmins) behind it. It replaces the Text widget. Everything lives on the git branch `chat` until it is released.

Plan and decisions per phase: `docs/live-chat-plan.md`. Go-live steps: `docs/live-chat-go-live.md`. Privacy wording draft: `docs/live-chat-privacy-draft.md`. CSP review: `docs/live-chat-csp-review.md`. Design reference: `docs/chat-demo.html`.

## Switches

| Switch | Where | Effect |
|---|---|---|
| `LIVECHAT_ENABLED` | backend env | Off (default): no sockets, no routes, no AI calls. Retention still runs. |
| `VITE_LIVECHAT_ENABLED` | frontend build env | On: our widget and the consent tracker are in the browser build and the Text widget is NOT rendered. Off: Text widget as before. |

Rollback: set both to `false`, rebuild the frontend, restart the backend. The Text widget returns at once (its package is still installed).

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
