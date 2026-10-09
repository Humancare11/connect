# Live Chat go-live checklist

Tick each item on staging first, then production.

## Environment
- [ ] Backend: `LIVECHAT_ENABLED=true`, `LIVECHAT_ENCRYPTION_KEY` (64 hex), `LIVECHAT_OPENAI_API_KEY`, `LIVECHAT_MODEL`, `TURNSTILE_SECRET_KEY`, `LIVECHAT_FOLLOWUP_MAILBOX`, S3 vars (`AWS_S3_BUCKET` etc.). See `backend/.env.example`.
- [ ] Frontend build: `VITE_LIVECHAT_ENABLED=true`, `VITE_TURNSTILE_SITE_KEY` (production keys, not the Cloudflare test keys; the test key always passes).
- [ ] `LIVECHAT_ENCRYPTION_KEY` backed up in two safe places. Losing it makes every chat unreadable.
- [ ] GeoIP file `dbip-city-lite.mmdb` on the server (`backend/data/` or `GEOIP_DB_PATH`). Not in the repo.
- [ ] Single backend instance, OR a shared presence store first: presence and the agent registry are in memory, so two instances would show different visitors.

## Agreements and accounts
- [ ] BAA signed with OpenAI, covering the model used (gpt-6-luna).
- [ ] BAAs confirmed for AWS (S3), MongoDB hosting and the email provider.
- [ ] Production OpenAI key lives in the company organization as a service account, restricted to the endpoints needed (chat completions only), with a monthly budget.
- [ ] Privacy policy and cookie banner wording reviewed by counsel and published (`docs/live-chat-privacy-draft.md`).

## Security
- [ ] Review admin accounts. `backend/seedAdmin.js` creates `admin@gmail.com` with a fixed password that is in the repo: delete or change that account in production and check for other weak admin logins.
- [ ] `/services-prices` (not changed in this branch): open it in a private window with no cookies and confirm the admin form does not render.
- [ ] Confirm GET/POST/PUT/DELETE on `/api/services` and `/api/pricing` are refused without a superadmin session (GET on services is public by design; write calls must be refused).
- [ ] Decide on the CSP proposal (`docs/live-chat-csp-review.md`). Nothing site-wide was changed.

## Staging tests
- [ ] A real file upload, open (presigned link) and delete against the S3 bucket (skipped in tests on purpose).
- [ ] A real AI chat, a handoff to an agent, an offline request with its email, a rating.
- [ ] Settings change by a superadmin applies to the next chat without a restart; an admin can only view.
- [ ] Retention: set a short period on staging and confirm chats and S3 objects go.
- [ ] Footer shows the DB-IP attribution link.

## After go-live
- [ ] Watch AI cost on Reports for a week; adjust the daily cap.
- [ ] After a quiet period, remove the Text widget (see `docs/live-chat.md`).
