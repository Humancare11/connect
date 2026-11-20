# Email Marketing

A separate admin page ("Email Marketing", right below "Email") for sending designed HTML emails to companies,
patients, doctors or anyone. **Marketing mail goes through Amazon SES only.** The Email page (Gmail) and every system
email (OTP, appointments, account) are untouched and never look at the marketing lists.

Branch: `admin`. Demo of the approved UI: `docs/email-marketing-demo.html`.

## How it works

- **One email per person.** Never several people in To/Cc/Bcc. From = the chosen Mail ID, Reply-To = the same address, so
  replies land in that Mail ID's Gmail and show on the Email page through the existing sync. The report links a reply to
  its campaign by matching the SES message id in `In-Reply-To` / `References`.
- **Who sees it.** Super Admin always. An admin only after a Super Admin switches it on (Campaigns page, "Who can use this
  page"). Nobody else sees the sidebar item or the API (403), and while `MARKETING_ENABLED` is not `true` the API does not
  exist (404).
- **Which Mail IDs.** Only Mail IDs with "Allowed for marketing" switched on (Email, Mail IDs, Edit). Off by default;
  `support@` stays off.
- **Queue (MongoDB).** A row is claimed atomically; throttled to `SES_MAX_SEND_RATE`; capped at `MARKETING_DAILY_CAP` per
  UTC day (the campaign waits and continues the next day). Resumes after a restart.
- **At most once.** SES `SendEmail` has no idempotency key, so a mail interrupted around the SES call becomes
  **uncertain**. It is never re-sent automatically; the report offers a manual "Retry uncertain".
- **Suppression.** One global list (unsubscribe, hard bounce, complaint), checked before every send. Marketing only.
- **Sanitising.** Scripts, event handlers, forms, iframes, `javascript:` URLs and unsafe CSS are removed on the server.
  Tables, images, links, inline styles and `<style>` blocks (cleaned) are kept.
- **Tracking.** Hidden open image and tracked links per recipient, with the same rules and switches as the Email page
  (scanner lists, Apple Mail Privacy Protection, grace window, dedupe). Never announced in the mail.
- **Unsubscribe.** Footer link plus `List-Unsubscribe` and `List-Unsubscribe-Post` (one-click). Signed token, public page
  at `/api/u/<token>`. Opening the link does not unsubscribe anyone; the button does.
- **Bounces and complaints.** SES, SNS, `POST /api/ses/events` (signature and topic verified) mark the recipient and add
  the address to the suppression list.
- **Privacy.** Recipient lists are only returned to authorised admins. Addresses, names and content are never logged.
  After `MARKETING_RETENTION_MONTHS` (12) the recipients' name, email and company are removed; counts and the suppression
  list stay.

## Environment variables (names; recommended values)

| Name | Recommended on UAT | Notes |
|---|---|---|
| `MARKETING_ENABLED` | `false` first, then `true` | Master switch. |
| `SES_REGION` | `ap-south-1` | |
| `SES_CONFIGURATION_SET` | the set you create | Publishes events to the SNS topic. |
| `SES_SNS_TOPIC_ARN` | the topic you create | Events from any other topic are refused. |
| `SES_MAX_SEND_RATE` | `1` (sandbox) | Per second; below the account limit. |
| `MARKETING_DAILY_CAP` | `500` | |
| `MARKETING_MAX_RECIPIENTS` | `2000` | Per campaign. |
| `MARKETING_UNSUB_SECRET` | 32+ random characters | Different for UAT and production. |
| `MARKETING_FOOTER_ADDRESS` | `Humancare Connect, Inc. · 4 Peddlers Row #1091, Newark, DE 19702, United States` | |
| `MARKETING_RETENTION_MONTHS` | `12` | |
| `MARKETING_LEASE_SECONDS` | `120` | |
| `MARKETING_TICK_MS` | `1000` | |
| `MARKETING_TESTS_PER_10_MIN` | `10` | |

Already needed for tracking and the unsubscribe link: `PUBLIC_TRACKING_BASE_URL` (public https), `EMAIL_TRACKING_ENABLED=true`,
`EMAIL_TRACKING_LINKS_ENABLED=true`, and the Super Admin tracking switches (Email, Mail IDs). Without a public https base
URL, `MARKETING_UNSUB_SECRET`, `MARKETING_FOOTER_ADDRESS` and `SES_CONFIGURATION_SET`, a send is refused with the names of
what is missing.

## AWS setup (ap-south-1)

1. SES, Verified identities, Create identity, Domain `humancareconnect.co`, Easy DKIM (RSA_2048). Publish the 3 CNAME records.
2. Optional custom MAIL FROM (for example `mail.humancareconnect.co`): `MX 10 feedback-smtp.ap-south-1.amazonses.com` and
   `TXT "v=spf1 include:amazonses.com ~all"` on that subdomain. Do not change the root SPF record (Google Workspace).
3. Check the DMARC record; DKIM alignment through the domain identity is enough.
4. Configuration set with an event destination (SNS topic) for Send, Delivery, Bounce, Complaint, Reject, Rendering failure
   and Delivery delay.
5. SNS standard topic, HTTPS subscription to `https://<public host>/api/ses/events`. It is confirmed automatically once the
   backend is running with `SES_SNS_TOPIC_ARN` set.
6. EC2 instance role: allow `ses:SendEmail` on the domain identity and the configuration set. No access keys.
7. Turn on the SES account-level suppression list for bounces and complaints (second layer).
8. Request production access when ready (the sandbox only delivers to verified addresses).

## UAT deploy steps

1. AWS and DNS as above. In the sandbox, verify the test recipient addresses.
2. Add the environment variables with `MARKETING_ENABLED=false`.
3. Deploy the backend first (`@aws-sdk/client-sesv2` is a new, pinned dependency: run `npm install`/`npm ci`), restart PM2.
   Indexes of the new collections are built by Mongoose at start-up.
4. Deploy the frontend.
5. Check nothing changed: Email page, OTP mail, sidebar (no new item yet for anyone).
6. Set `MARKETING_ENABLED=true`, restart. The sidebar item now appears for the Super Admin.
7. Email, Mail IDs, Edit `strategicalliance@humancareconnect.co`, tick "Allowed for marketing". Leave every other Mail ID off.
8. Work through the checklist below.

## UAT test checklist

1. **Access.** Super Admin sees "Email Marketing" below "Email". An admin does not. Typing the address as that admin shows
   "You do not have access". Switch the admin on ("Who can use this page"); the item appears after a reload; switch off:
   gone, and the API answers 403 at once. Patient, doctor, partner and payment-admin logins never see it.
2. **Mail IDs.** In the From list only `strategicalliance@` appears; `support@` and `tech@` do not.
3. **Recipients.** Try each mode (addresses, Name + email, Name + Company + email, CSV). Check the counts: will receive,
   invalid, duplicates removed (different capitals), unsubscribed skipped. Over 2000 is refused.
4. **Content.** Paste HTML with `{{name}}`, `{{company}}` and a `<script>`. Upload an `.html` file. Insert-placeholder buttons.
5. **Preview.** Previous/next person, desktop/mobile, the script is gone, the checks list is right (http image, size).
6. **Test mail.** To a verified address: `[Test]` in the subject, the first person's name, footer and unsubscribe link, no
   tracking.
7. **Send.** The Send button stays off until the box is ticked. Close the page mid-way: sending continues; reopen: progress.
   Pressing Send twice starts it once.
8. **Delivery.** One separate email per person, From and Reply-To = the Mail ID, never two addresses in To.
9. **Headers** (Show original in Gmail): `List-Unsubscribe`, `List-Unsubscribe-Post`, DKIM pass, SPF/DMARC pass.
10. **Tracking.** Open (not on Apple Mail) and click a link: the report shows Opened/Clicked within a minute.
11. **Reply.** Reply from the test inbox: it shows in the Mail ID's Received folder and the report shows Replied. If the
    report does not link it, send the details of the reply's `In-Reply-To` header: SES rewrites Message-IDs and this is the one
    thing to confirm on real mail.
12. **Unsubscribe.** Open the link (nothing happens yet), press Unsubscribe: the success text appears; the person is in the
    report as Unsubscribed; a new campaign to the same address skips them. One-click works from Gmail's own "Unsubscribe".
13. **Bounce and complaint.** Send to the SES simulator addresses `bounce@simulator.amazonses.com` and
    `complaint@simulator.amazonses.com` (allowed in the sandbox): they show Bounced / Complained and land on the suppression list.
14. **Stop sending.** Start a campaign of a few addresses at a low rate and press Stop: the rest are skipped.
15. **Daily cap.** Set `MARKETING_DAILY_CAP=2`, send 5: it stops at 2 with the "daily limit" message and continues after midnight UTC.
16. **Restart.** Restart PM2 mid-campaign: it carries on; nobody gets two copies; an interrupted one shows as Uncertain.
17. **Not affected.** Email page (inbox, compose, reply), OTP and appointment mails work as before.
18. **Off switch.** `MARKETING_ENABLED=false` and restart: the sidebar item and the API disappear; an old unsubscribe link still works.
