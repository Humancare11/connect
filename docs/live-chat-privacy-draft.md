# Live Chat privacy wording: DRAFT, NOT PUBLISHED

For review by counsel. Nothing here is live on the site. Do not paste into the app until approved.

## Cookie banner (replacement text)

> We use cookies and similar technologies to improve your experience and analyze website traffic. If you accept, our support team can also see which pages you are viewing while you use our chat, so we can help you faster. You can decline and still use the site, and you can still chat with us.

Buttons: Accept / Decline (unchanged).

## Privacy Policy: new section "Website chat"

> **Website chat.** When you use our chat, we collect your name, email address, optional phone number, the messages you send, any files you upload, and technical information such as your IP address and approximate location. Our first responder is an AI assistant operated for us by OpenAI, and messages are sent to it to produce a reply. Our support staff can read the conversation. Do not share more health information in chat than you need to. The assistant does not diagnose or recommend medication. In an emergency call 911.
>
> If you accepted cookies, we also record the pages you view on our website while the chat is available, and our team can see them in real time while you are chatting.
>
> We encrypt chat content and files. We keep chats, files and chat contact details for 12 months and then delete them. We keep only the AI usage totals (cost and counts) longer. We do not sell chat data.
>
> Approximate location comes from IP address data by DB-IP (db-ip.com).

## Cookie Policy: additions

- Storage used by chat: a first-party visitor identifier and a chat session token, kept in the browser so a chat can continue within 24 hours. The page-view tracker runs only after you accept cookies.
- Cloudflare Turnstile runs on the contact form to block bots and may set its own cookies.

## Items for counsel

- Whether the HIPAA Notice of Privacy Practices needs a chat reference.
- Whether the 12-month period matches your retention schedule.
- Whether chat messages sent to OpenAI need a line in the California notice.
- The in-chat disclosures (data use, AI processing by OpenAI, page tracking) now exist only in the unpublished Privacy Policy and cookie-banner draft text above; confirm what must be published, and whether any in-chat notice is still required, before go-live.

## Widget notices removed (2026-10-10)

The three in-widget lines were removed on 2026-10-10 at the owner's request:

1. Contact form: "Only the Humancare support team sees these details. By starting the chat you agree to our Privacy Policy."
2. Chat footer: "AI answers are general information, not medical advice."
3. Chat footer: "Chat messages and, with your consent, the pages you visit are used to provide support."

What this means in the code:

- The contact form has no privacy notice. The request no longer needs a `consent` flag and **no in-chat privacy acceptance is recorded any more**: new chats do not write `consent.privacyAcceptedAt`. Records written before 2026-10-10 are unchanged.
- Cookie and page-tracking consent from the cookie banner is separate and unchanged: the page-view tracker still runs only after the visitor accepts cookies.
- The AI itself says "general information, not medical advice" and suggests booking a consultation when a patient asks a medical question (AI safety rule).

**Counsel must confirm whether any in-chat notice is required before go-live.** Publishing the "Website chat" Privacy Policy section above is a go-live blocker (see `docs/live-chat-go-live.md`).
