# Live Chat privacy wording: DRAFT, NOT PUBLISHED

For review by counsel. Nothing here is live on the site. Do not paste into the app until approved.

## Cookie banner (replacement text)

> We use cookies and similar technologies to improve your experience and analyze website traffic. If you accept, our support team can also see which pages you are viewing while you use our chat, so we can help you faster. You can decline and still use the site, and you can still chat with us.

Buttons: Accept / Decline (unchanged).

## Privacy Policy: new section "Website chat"

> **Website chat.** When you use our chat, we collect your name, email address, optional phone number, the messages you send, any files you upload, and technical information such as your IP address and approximate location. Our first responder is an AI assistant called "Connect AI" (it is an AI, not a person, doctor or nurse), operated for us by OpenAI, and messages are sent to it to produce a reply. Our support staff can read the conversation. Do not share more health information in chat than you need to. The assistant does not diagnose or recommend medication. In an emergency call 911.
>
> If you accepted cookies, we also record the pages you view on our website while the chat is available, and our team can see them in real time while you are chatting.
>
> We encrypt chat content and files. We keep chats, files and chat contact details for 12 months and then delete them. We keep only the AI usage totals (cost and counts) longer. We do not sell chat data.
>
> Approximate location comes from IP address data by DB-IP (db-ip.com).

## Cookie Policy: additions

- Storage used by chat: a first-party visitor identifier and a chat session token, kept in the browser so a chat can continue within 24 hours. The page-view tracker runs only after you accept cookies.

## Items for counsel

- Whether the HIPAA Notice of Privacy Practices needs a chat reference.
- Whether the 12-month period matches your retention schedule.
- Whether chat messages sent to OpenAI need a line in the California notice.
- The in-chat disclosures (data use, AI processing by OpenAI, page tracking) now exist only in the unpublished Privacy Policy and cookie-banner draft text above; confirm what must be published, and whether any in-chat notice is still required, before go-live.

New data flows from the redesigned admin UI (added 2026-10-12). The Privacy Policy "Website chat" text above does not yet describe them; counsel to confirm what must be disclosed, to whom, and whether the OpenAI agreement and the HIPAA/CCPA treatment of the vendor cover each one.

1. **AI "Suggest a reply" (admin tool).** The last chat messages are sent to OpenAI to draft an agent reply. Before sending, the server replaces the patient's name, email address and phone number (and anything that looks like an email or a phone number) with `[name]`, `[email]`, `[phone]`. No contact fields, chat or visitor ids, file names or internal notes are sent. The draft is only shown to the admin, who edits and sends it. Counts toward the daily AI cap.
2. **AI "Tell me about this patient" (summary).** On request only, up to the last 30 chat messages are sent to OpenAI for a 2 to 4 sentence summary, redacted the same way as item 1. The summary is shown to the admin and is not stored. Counts toward the daily AI cap.
3. **Translation (English view and reply translation).** Message text is sent to OpenAI to translate (patient, AI and agent messages for the English view; the admin's draft for reply translation, now into any of 16 languages the admin picks). The patient's name, email and phone, links, prices and email addresses are replaced by placeholders before sending and restored afterwards. Translations of patient messages are cached, encrypted, on the message. Internal notes, files and system lines are never sent.
4. **Transcript downloads.** An admin can download a chat as a plain-text file (no internal notes, file named by chat id only, not cached). Each download is recorded on the chat (admin and time, last 50) for as long as the chat exists. The file itself then lives on the admin's computer outside the system; counsel to consider the admin-device policy.
5. **Patient context fields.** Admins can record Follow-up date, Preferred language, Contact preference, Reason for contact and up to 10 further text fields (defined by a Super Admin) about a patient. These are free text and may contain health-related information. They are encrypted with the live chat key, stored on the visitor record, shared across that patient's chats and deleted by the 12-month live chat retention with the visitor. Counsel to confirm whether patients must be told and whether they can ask to see or delete them.
6. **Files sent to patients.** Admins can send a PDF, JPG or PNG (10 MB) to a patient in the chat. Stored like a patient upload (S3, random key, server-side encryption, file name encrypted in the database) and deleted with the chat. The patient opens it only through a 5-minute link limited to their own chat; each open is logged on the file. File names are never sent to the AI. Counsel to confirm whether PHI may be sent this way and what wording the patient should see.

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
