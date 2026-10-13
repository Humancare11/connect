# Live Chat go-live checklist

Tick each item on staging first, then production.

## BLOCKER before go-live
- [ ] **BLOCKER:** Publish the "Website chat" section of the Privacy Policy (AI processing by OpenAI, message storage and retention, page tracking with cookie consent) after counsel approval, before `LIVECHAT_ENABLED` / `VITE_LIVECHAT_ENABLED` are turned on in production. The in-widget privacy and tracking notices were removed on 2026-10-10, so the Privacy Policy is the only place patients are told. Wording: `docs/live-chat-privacy-draft.md`.

## Environment
- [ ] Backend: `LIVECHAT_ENABLED=true`, `LIVECHAT_ENCRYPTION_KEY` (64 hex), `LIVECHAT_OPENAI_API_KEY`, `LIVECHAT_MODEL`, `TURNSTILE_SECRET_KEY`, `LIVECHAT_FOLLOWUP_MAILBOX`, S3 vars (`AWS_S3_BUCKET` etc.). See `backend/.env.example`.
- [ ] Frontend build: `VITE_LIVECHAT_ENABLED=true`, `VITE_TURNSTILE_SITE_KEY` (production keys, not the Cloudflare test keys; the test key always passes).
- [ ] `LIVECHAT_ENCRYPTION_KEY` backed up in two safe places. Losing it makes every chat unreadable.
- [ ] Per-IP daily chat limit: `LIVECHAT_CHATS_PER_IP_DAY` (default 20 new chats per IP per rolling 24 h; the old name `LIVECHAT_IP_DAILY_CHAT_LIMIT` still works). Outside production it is skipped for loopback IPs and `LIVECHAT_DEV_FAKE_IP` (logged once at startup); in production it always applies. Patients who hit it see a message in the chat and can email support@humancareconnect.co.
- [ ] GeoIP file `dbip-city-lite.mmdb` on the server (`backend/data/` or `GEOIP_DB_PATH`). Not in the repo.
  - [ ] Check the backend startup log for `[geoip] Loaded <path>`. If it says `WARNING: location database not found`, City / State / Country on Real-time visitors stay empty (the visitor is still listed; nothing else breaks).
  - [ ] Visitors need a public IP: behind Render (and Cloudflare or Nginx) set `TRUST_PROXY` to the number of proxies in front of Node (default 1; use 2 for Cloudflare/Render + Nginx) so the visitor's address, not the proxy's, is used. `LIVECHAT_DEV_FAKE_IP` is development only and is ignored in production.
  - [ ] Fallback if the file is missing on Render: the file is not in the repo, so download it during the build. In the backend service set the Build Command to (Render runs it in the `backend` directory):
    ```
    npm install && mkdir -p data && (curl -fsSL "https://download.db-ip.com/free/dbip-city-lite-$(date +%Y-%m).mmdb.gz" || curl -fsSL "https://download.db-ip.com/free/dbip-city-lite-$(date -d 'last month' +%Y-%m).mmdb.gz") | gunzip > data/dbip-city-lite.mmdb
    ```
    The first URL is this month's file and the second is last month's (the new file may not be up on the 1st). The file is re-downloaded on every deploy, so redeploy about once a month to refresh it; a build that cannot download it should fail loudly, so check the deploy log. Or keep the file on a persistent disk and set `GEOIP_DB_PATH` to it.
  - [ ] Attribution (CC BY 4.0): the site footer and the Real-time visitors page link "IP Geolocation by DB-IP" to https://db-ip.com. Keep both.
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
- [ ] A real AI chat, a handoff to an agent, the email follow-up after the follow-up time with its email, a rating.
- [ ] Settings change by a superadmin applies to the next chat without a restart; an admin can only view.
- [ ] Retention: set a short period on staging and confirm chats and S3 objects go.
- [ ] Footer shows the DB-IP attribution link.

## After go-live
- [ ] Watch AI cost on Reports for a week; adjust the daily cap.
- [ ] After a quiet period, remove the Text widget (see `docs/live-chat.md`).

## Scaling note
- Agent presence is in memory per process. Run the backend as a single instance, or add a shared Socket.IO adapter (e.g. Redis) before scaling to more than one instance.
