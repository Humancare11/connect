# Live Chat privacy wording: DRAFT, NOT PUBLISHED

**DRAFT – pending counsel review.**

For review by counsel. Nothing here is live on the site. Do not paste into the app until approved.

## Cookie banner (replacement text)

> We use cookies and similar technologies to improve your experience and analyze website traffic. If you accept, our support team can also see which pages you are viewing while you use our chat, so we can help you faster. You can decline and still use the site, and you can still chat with us.

Buttons: Accept / Decline (unchanged).

## Privacy Policy: new section "Website Chat and AI Assistant"

**DRAFT – pending counsel review.** Proposed text from counsel, 2026-10-15. Not live. The live `/privacy-policy` page is unchanged. The widget's AI notice links to the anchor `#website-chat`, so this section must be published with that anchor before the Super Admin setting **Show AI notice** is switched on (it is OFF).

---
### Website Chat and AI Assistant  (anchor: #website-chat)

Our website has a chat window. When you open it, you first chat with Connect AI, an automated assistant. You can ask for a live member of our team at any time.

**Connect AI is not a doctor.** It does not diagnose conditions, recommend treatments or medications, or interpret symptoms or test results. It can answer questions about our services, prices and booking, and help you book a visit with a licensed Humancare clinician. The chat is not for emergencies. If you have a medical emergency, call 911 or your local emergency number.

**What we collect in chat.** Your name and email address (required), your phone number (optional), the messages and files you send, the language you write in, and technical details such as your device, browser, the pages you visit on our site and your approximate location (city, state and country) based on your IP address.

**How we use it.** To answer your questions, connect you with our team, translate messages between you and our staff, email you if we could not reply in the chat, keep a record of the conversation, and protect the chat from abuse.

**How the AI assistant processes your messages.** Your messages are processed by our AI service provider, OpenAI, under a Business Associate Agreement as required by HIPAA. Before your messages are sent, we remove your name, email address and phone number. We instruct OpenAI not to store the requests, and OpenAI does not use them to train its models. The same provider helps our staff with translations, reply suggestions and conversation summaries.

**Human review.** Members of our support and clinical team can read chat conversations, including those handled only by Connect AI. Conversations about medical topics are flagged and reviewed by our team to check the assistant's answers.

**Who else receives your information.** Our hosting, database and email providers, each under an agreement that protects your information. We do not sell your chat information or use it for advertising.

**Security and retention.** Chat messages and contact details are encrypted when stored. Conversations are kept for 365 days and then deleted, unless the law requires us to keep them longer.

**Your choices and rights.** You can ask to chat with a person instead of Connect AI at any time. You can request a copy of your chat or ask us to delete it by emailing [privacy contact email]. You may have other rights under the laws of your state, as described elsewhere in this policy.

*Last updated: [publish date]*

---

The earlier "Website chat" paragraph (OpenAI operates the assistant, DB-IP location credit, cookie-consented page tracking) is replaced by the text above. Two sentences of it are not in counsel's text and should be kept elsewhere in the policy if still wanted: the page-view tracking that runs only after cookies are accepted (see the cookie banner and Cookie Policy below), and the DB-IP attribution for approximate location.

## Cookie Policy: additions

- Storage used by chat: a first-party visitor identifier and a chat session token, kept in the browser so a chat can continue within 24 hours. The page-view tracker runs only after you accept cookies.

## Items for counsel

- **Checks of the proposed "Website Chat and AI Assistant" text against how the system works (2026-10-15):**
  - *Retention:* the text says 365 days; the system's live-chat retention policy is 12 months by default (a retention setting, not a fixed number of days). Align the wording or the setting.
  - *Removing name, email and phone:* done before every AI call that carries chat text: the main reply, "Suggest a reply" and summaries (replaced by `[name]`, `[email]`, `[phone]`), translation (placeholders, restored afterwards) and language detection (the patient's known name, whole and in parts, plus any email- or phone-like text, is replaced by `[name]` / `[email]` / `[phone]` first; tests check this). The removal knows the name, email and phone the patient gave in the contact form; a third party's name or other people's details typed into a message, and free-text health details, are not removed.
  - *"We instruct OpenAI not to store the requests":* every live-chat model call is sent with `store: false`. Counsel to confirm this is the instruction the text means, and that the "does not use them to train" statement matches the Business Associate Agreement and the OpenAI organisation/project settings (`LIVECHAT_OPENAI_ORG_ID`, `LIVECHAT_OPENAI_PROJECT_ID`).
  - *Human review:* medical chats (reply blocked, emergency keyword, or medical topic) are flagged and reviewed on the AI Review page; reviewers' notes are kept in an append-only log that retention does not delete (it holds the chat id, date and reasons and an encrypted note, no transcript). Counsel to say whether that log needs a line in the policy and a retention period.
  - *Emergency and "not a doctor":* the system matches the text: the AI refuses medical advice and a fixed 911 message is sent when an emergency is detected.

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
- **Update 2026-10-15:** an AI notice above "Start chat" now exists in the code behind the Super Admin setting **Show AI notice** (OFF by default, so nothing is shown or recorded today). When ON it shows: "Connect AI is an automated assistant, not a doctor. It can't diagnose or give medical advice. Your messages may be processed by our service providers under HIPAA agreements. See our Privacy Policy." and below the button "By starting the chat, you agree to this notice and our Privacy Policy." (links to `/privacy-policy#website-chat`; no checkbox). Pressing Start chat records `consent.aiNoticeAcceptedAt` and `consent.policyVersion` (setting, default `v1`) on the visitor and the chat. The older `privacyAcceptedAt` field stays unused. The earlier line "AI answers are general information, not medical advice" stays removed: the AI now gives no medical information at all.
- Cookie and page-tracking consent from the cookie banner is separate and unchanged: the page-view tracker still runs only after the visitor accepts cookies.
- The AI itself no longer gives "general information": for any medical question it says it cannot give medical advice and that a licensed Humancare doctor can help, and shows the booking link (AI safety rule, 2026-10-15).

**Counsel must confirm whether any in-chat notice is required before go-live.** Publishing the "Website Chat and AI Assistant" Privacy Policy section above (with the `#website-chat` anchor) is a go-live blocker (see `docs/live-chat-go-live.md`).
