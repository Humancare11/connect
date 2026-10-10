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

## PROPOSED widget notice changes: NOT IMPLEMENTED, NOT LEGALLY APPROVED

Status as of 2026-10-10. The owner asked to remove three in-widget lines. **None of this has been applied**; the widget still shows all three lines. This section only records the proposal and what is outstanding.

Lines proposed for removal:

1. Contact form: "Only the Humancare support team sees these details. By starting the chat you agree to our Privacy Policy."
2. Chat footer: "AI answers are general information, not medical advice."
3. Chat footer: "Chat messages and, with your consent, the pages you visit are used to provide support."

Current decision (owner, 2026-10-10): **keep** the contact-form notice "By starting the chat you agree to our Privacy Policy." The consent requirement and the consent record are unchanged. The two footer lines are not removed in this change either; any removal needs a separate approval.

Why this needs counsel before anything is removed:

- The contact form has no checkbox. The client sends `consent: true` as a fixed value, the server refuses the request without it, and the server stores `consent.privacyAcceptedAt`. The contact-form line is the only text the patient sees that this record can refer to.
- The "Website chat" Privacy Policy section and the new cookie-banner text in this draft are not published. Until they are, the in-widget lines are the only patient-facing disclosure that chat content is used for support and that pages are tracked only with consent.
- None of the three lines mentions that messages are sent to an AI provider (OpenAI); that disclosure exists only in the unpublished draft text above.
- The AI disclaimer ("general information, not medical advice") is now also given by the AI itself when a patient asks a medical question (AI safety rule added 2026-10-10).

Outstanding for counsel:

- Confirm whether any in-chat notice is required (privacy notice, AI disclosure, page-tracking notice) once the Privacy Policy and cookie banner are updated.
- If the contact-form notice is ever removed, decide what the consent record should be (keep, rename, or drop `consent.privacyAcceptedAt`).
