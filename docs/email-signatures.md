# Email: personal signatures

Branch: `feature/email-signatures` (from `uat`). UAT first. Production stays as it is until approved.

## What it is

Every admin and Super Admin can keep their own signatures under **Email, My signature**
(`/admin-dashboard/email/settings/my-signature`).

- **Several signatures**, each with a name ("Formal", "Short"). One can be marked **default**.
- **Private.** You see and change only your own. No other admin can see them, and neither can a Super Admin.
- **Plain text**, up to 1000 characters and 20 lines. No images.
- **Optional per mailbox:** "when I write from strategicalliance@, use this one".
- A new signature starts from your name plus the company footer text. Edit it as you like.

## What clients see

Until now a client never saw an admin's name. With a signature they do, exactly as you write it. That is the
point of the feature, so write only what you want a client to see.

## In the compose and reply boxes

- Your default signature (or the one chosen for that mailbox) is inserted **below your message**, under a
  `-- ` line, inside the text. You can edit it for this one mail; your saved signature does not change.
- The **Signature** dropdown under the message switches signature, or picks **No signature**. Your message is
  never touched. If you edited the inserted signature, you are asked before it is replaced.
- Changing the **From** mailbox changes the signature while you have not chosen one yourself.
- An inserted signature alone is not a message: "Discard?" and "Message is required" look at what you wrote.

### Order in the mail

```
Your message

-- 
Your signature

Company footer         (set per Mail ID; see the setting below)
```

With **No signature** the mail is exactly as before: message, then `-- ` and the company footer.

If a mail has secure attachment links, the attachment lines sit between the message and the signature.

### The company footer setting (Super Admin)

Email, Settings, Mail IDs, tracking card: **Also add the company footer when an admin signature is used**
(default **on**). Switch it off if signatures already carry what the footer says. Mail sent with "No
signature" always carries the company footer.

"Signature used" means the dropdown is not "No signature". If you delete the signature text by hand but leave
the dropdown on a signature, the box tells you; choose "No signature" to get the company footer as usual.

## Links in a signature and tracking

- `https://...` and `www....` in a signature become clickable in the HTML part of the mail.
- When link tracking is on, signature links are **tracked like any other link**.
- **Caveat:** a click on a signature link also makes the mail show **Clicked**. The mail page lists each link
  with its count, so you can see whether it was the signature (for example the website) or a link in the message.
- Opens, read receipts, secure links, opt-outs and scanner rules are unchanged. The footer tracking notice
  (off by default) still comes last.

## The Sent copy

The dashboard keeps the mail exactly as sent: message, signature and company footer.

## Limits

10 signatures per admin, names up to 40 characters, no two with the same name (ignoring case). A line that is
only `--` is not allowed in a signature, because that is the divider the mail adds.

Deleting your default leaves you with no default (nothing is promoted). Deleting a signature does not change
mail already sent.

## UAT script

Two admin accounts (A, B) and the Super Admin (S).

| Step | Do | Expect |
|---|---|---|
| 1 | As A: Email, My signature. | Empty list; "+ New signature". The form starts with A's name and the company footer. |
| 2 | As A: save "Formal" (name, title, `www.humancareconnect.co`). | Saved, marked Default. |
| 3 | As A: add "Short". Make it default, then back. | Exactly one Default at any time. |
| 4 | As B: open My signature. | B sees none of A's signatures. |
| 5 | As S: open My signature. | S sees none of A's or B's, only their own. |
| 6 | As A: Compose. | Formal is inserted below an empty message under `-- `; the caret is above it. |
| 7 | Type a message, switch the dropdown to Short. | Message untouched, signature swapped. |
| 8 | Edit the inserted signature, then switch the dropdown. | A prompt "Replace your edited signature?" |
| 9 | Pick No signature. | Signature and `-- ` line disappear. |
| 10 | Send to your Gmail with a signature. | Message, `-- `, signature, then the company footer. One divider. |
| 11 | Open the mail page in the dashboard (Sent). | The same text as received. |
| 12 | Gmail: click the website link in the signature. | The link opens at once. Read status **Clicked**; the link list shows it. |
| 13 | Super Admin switches the footer setting off. Send again. | Message and signature only. |
| 14 | Send with No signature. | Message, `-- `, company footer, as always. |
| 15 | Reply to a client mail. | Signature below the reply, same rules. |
| 16 | As A: Per mailbox, choose Short for strategicalliance@. Compose from it. | Short is inserted; from support@ it is Formal again. |
| 17 | Send with a secure link attachment. | Attachment lines above the signature. |
| 18 | As A: delete the default. | No default; a new compose opens without a signature. |

---

# Image signatures

Branch: `feature/email-signature-images` (from `uat`). UAT first.

## What it is

A signature can be **text only**, **image only**, or **image with text lines below**. The image is a business-card
style banner you upload on **My signature**.

- **PNG or JPG only.** SVG, GIF, WebP and anything else is refused, whatever the file is called.
- **Resized and cleaned on the server:** at most 600 px wide, at most 400 px high, under 200 KB, metadata
  (EXIF, location, colour profile) removed, transparency put on white. What is stored and sent is our
  re-encoded copy, never the uploaded file.
- **Private:** only you can see, replace or use it. Stored in a private place, shown to you through your login.
- **Tip:** a simple 600px-wide banner (logo, name, title). Put phone, email, website and address as text
  lines below: they stay readable and clickable.
- Optional: **alt text** (empty uses the first text line) and **one link for the whole image**.

### The text box

| Layout | The text box is | Used for |
|---|---|---|
| Text only | the signature | plain text and HTML |
| Image only | the **text version** | the plain-text part only (and mail apps that cannot show images) |
| Image + text | the **text lines** | shown below the image, and in the plain-text part |

The text is always required, so plain-text mail always has a signature.

## In the compose and reply boxes

- The composer is still plain text. The text lines sit under the `-- ` line and can be edited for one mail.
- Under the box a **preview** shows the chosen signature: the image and the text lines as you edited them.
- The image cannot be changed for one mail; the dropdown switches the whole signature.
- Image signatures are marked "(image)" in the dropdown.

## In the mail itself

- The image is **embedded** in the mail (not a web address), so it shows even when the recipient's mail app
  blocks remote images.
- It is an **inline** part with no file name, to make mail apps less likely to list it as an attachment.
- The **plain-text** part is unchanged: message, `-- `, the text version, company footer.
- The HTML part shows: message, image (inside a link if you set one), text lines (image + text only),
  company footer. The `-- ` line is replaced by the image.
- With "No signature" the mail is exactly as before.

### Which mail apps may still show it as an attachment

Not fully avoidable with an embedded image. Expect, to be confirmed on UAT with your inboxes:

- **Usually inline only:** Gmail on the web, Apple Mail on a Mac, Outlook.com / Outlook on the web.
- **May show a paperclip or an attachment entry:** Thunderbird (lists inline images in its attachment pane),
  Yahoo Mail, Zoho Mail, Outlook desktop (message list), the Gmail and Outlook phone apps, older Android
  mail apps.
- **When the recipient replies or forwards,** the image often becomes an `image001.png` attachment. That is
  how embedded signatures behave; it is the price of an image that does not depend on remote loading.

## Sent mail and the dashboard

Each mail keeps **its own copy** of the image. Replacing or deleting your signature later never changes mail
already sent. The mail page shows the image where the signature was.

If your image cannot be loaded when you send, the mail is **not sent** and you are told so; choose another
signature or No signature, or try again. A reply you were sending is not marked as replied.

## Effects

- **Spam score:** an HTML mail with a small banner and real text is normal (Outlook signatures do the same). We
  always send the text version and keep the image small, with alt text. A mail that was plain text becomes
  HTML as soon as it carries an image signature, even with tracking off.
- **Size:** at most about 270 KB added per mail. The attachment limits are unchanged and the image does not
  count against them.
- **Open tracking:** the tracking image is separate, 1x1, invisible and last. The signature image is part of
  the mail, never requested from our server, so it cannot count as an open.
- **Click tracking:** a link on the image is tracked like any link (on a tracked mail). A click on it makes the
  mail show **Clicked**.
- **Secure links:** files stay out of the mail as before; only the small signature image travels with it.
  Attachment lines stay above the signature.

## Deployment note

The backend gains one dependency: **`sharp`** (image processing, with prebuilt binaries). Deploy with
`npm ci` on the UAT host so the right binary is installed. Nothing else changes: no new environment
variables, no migration.

## UAT script (image signatures)

| Step | Do | Expect |
|---|---|---|
| 1 | My signature, New. Choose a PNG banner. | Preview of your file; "What to show" appears; the tip is next to the upload. |
| 2 | Choose "Image with text lines below", fill the text lines, Save. | Card shows the image and the text. |
| 3 | Upload an SVG, then a GIF, then a renamed text file. | Each is refused with a plain message. |
| 4 | Upload a 1800 px wide image. | Saved at 600 px wide. |
| 5 | Upload a phone photo (with location). | Accepted; the stored copy has no metadata. |
| 6 | As another admin and as the Super Admin, open My signature. | Neither sees your signature or image. |
| 7 | Compose to your Gmail with the image signature. | Preview under the box; image shows in Gmail; plain text shows the text lines. |
| 8 | Switch the layout to Image only, send again. | Gmail shows the image only; "Show original" plain part holds the text version. |
| 9 | Add a link to the image, send with "Track opens" on, click the image. | Opens the site; the mail shows **Clicked**. |
| 10 | Send with "Track opens" off. | Image still shows; no tracking image in the mail. |
| 11 | Open the mail in each inbox (Gmail, Outlook.com, Yahoo, Zoho, iPhone, Outlook desktop, Thunderbird). | Note where the image appears as an attachment (see the list above). |
| 12 | Block remote images in your mail app and open the mail. | The signature image still shows. |
| 13 | Open the mail in the dashboard (Sent). | Image where the signature was. |
| 14 | Replace the signature's image, then open the old mail again. | The old mail still shows the old image. |
| 15 | Delete the signature, open the old mail. | Still shows its image. |
| 16 | Send with a secure-link attachment. | Attachment lines above the signature; no PDF part; only the image is inline. |
| 17 | Reply to a client mail with the image signature. | Same, below the reply. |
