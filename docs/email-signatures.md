# Email: my signature (one image)

Every admin and Super Admin can have **one signature image**. It is added below the message in the mails they
send from the Email module. There are no text signatures, no names, no layouts and no per-mailbox choices.

Approved design: [email-signature-demo.html](email-signature-demo.html).

## My signature page

Email → **My signature** (`/admin-dashboard/email/settings/my-signature`).

- **Upload** by dragging a PNG or JPG onto the box, or by clicking it.
- **How it looks in a mail** shows the image under a sample message.
- **Replace image** and **Remove** (Remove asks first). Mail already sent is not changed.
- **Add to new mails automatically** (on by default) decides whether the box under the message starts ticked.

Only you can see or change your signature. Other admins have their own. A Super Admin has no override.

## What happens to the image

Whatever is uploaded is decoded and re-encoded on the server (`sharp`), so what is stored and sent is our file:

- only PNG or JPG (checked from the bytes: SVG, GIF, WebP, HEIC and renamed files are refused); up to 5 MB uploaded
- resized to at most 600 px wide (never enlarged), at most 400 px high, at least 50 × 20 px
- all metadata removed (EXIF, GPS, colour profiles), transparency flattened onto white
- kept as PNG when it fits in **200 KB**, otherwise saved as JPG at falling quality; refused if it still does not fit
- stored privately in S3 under `email-signature-images/<admin id>/`; the address is never sent to the browser, and
  the image is only served to its owner through the API
- 20 uploads per admin per hour

## In the compose and reply boxes

Nothing is inserted into the message: no `--`, no name, no text lines. Under the message box a small strip shows:

- the signature image,
- an **Add my signature** checkbox (starts as the automatic setting above; untick it for one mail),
- a **Change** link to My signature (opens in a new tab, so a half-written mail is not lost).

With no image yet the strip says "No signature yet. Upload one".

## In the mail itself

| Part | Content |
|---|---|
| HTML | the message, then the image (inline, `cid:`), then the tracking notice if any, then the tracking pixel (always last) |
| Plain text | just the message (and attachment lines / notice). No signature text. |
| Alt text | fixed: `Signature` |
| Company footer | **not added** when the image is used. Mail sent without the signature carries the Mail ID's text footer as before. |

The image is an inline part (`multipart/related`) with no file name, so it shows even when the recipient's mail app
blocks remote images. The image is not a link. Links written in the message are tracked as usual.

### Which mail apps may still show it as an attachment

Not fully avoidable with an embedded image. Expect, to be confirmed on UAT with your inboxes:

- **Usually inline only:** Gmail on the web, Apple Mail on a Mac, Outlook.com / Outlook on the web.
- **May show a paperclip or an attachment entry:** Thunderbird, Yahoo Mail, Zoho Mail, Outlook desktop (message list),
  the Gmail and Outlook phone apps, older Android mail apps.
- **When the recipient replies or forwards,** the image often becomes an `image001.png` attachment.

## Sent mail and the dashboard

Each sent mail keeps **its own copy** of the image (`email-sent-signatures/…`), so replacing or removing the signature
later never changes an old mail. The mail page shows that copy below the message. Open tracking, click tracking, read
receipts and secure links are unchanged.

If the box is ticked but there is no image (or it cannot be loaded), the mail is **not sent** and the admin is told why.

## Deployment note

1. **Clean up the old data once** (UAT only so far). Dry run first, then apply:

   ```
   cd backend
   NODE_ENV=uat node scripts/cleanupEmailSignatures.js            # shows what it would do
   NODE_ENV=uat node scripts/cleanupEmailSignatures.js --apply    # does it
   ```

   Per admin it keeps one signature that has an image (the default one, else the newest), strips it to the new shape
   and deletes the rest (text-only and extra ones), including their S3 image files. It drops the per-mailbox defaults
   collection and the old indexes, and builds the new one-per-admin index. Safe to run twice. Images already attached to
   sent mail are never touched. Run it before or right after deploying; until it has run, the new unique index may not
   build (an error in the log at start-up, nothing breaks).
2. **S3:** nothing new. The signature routes use the same bucket and credentials as email attachments and need
   `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on `email-signature-images/*` and `email-sent-signatures/*`
   (a bucket-wide policy already covers this). The browser never talks to S3: it fetches the image from the API.
3. **Content-Security-Policy:** the admin pages show the image from a `blob:` address, so `img-src` in
   `frontend/index.html` must include `blob:`. It was missing, which is why the preview showed only the alt text on UAT.
   This needs a **frontend deploy**.
4. The Super Admin setting "Also add the company footer when an admin signature is used" is gone from the screen. It no
   longer has any effect (the image never has the text footer).

## UAT script

1. Open My signature as an admin with no image: the upload box shows; the automatic switch is on.
2. Drag in a PNG: it appears under "How it looks in a mail" (not just alt text). Try a 2000 px wide JPG, an SVG, a GIF and
   a 6 MB file: the first is resized, the others are refused with a clear message.
3. Replace the image; the preview changes. Remove it; confirm asks first.
4. Untick "Add to new mails automatically". Open Compose: the box is unticked. Tick it for one mail.
5. Compose: the message box is empty (no `--`, no name). The strip shows the image, "Add my signature" and "Change".
6. Send to your own Gmail and Outlook: message, then the image; no "Human Care Connect" text footer; alt text `Signature`.
   View the plain-text version: just the message.
7. Send again with the box unticked: no image, the text footer is there as before.
8. Reply to a received mail with the signature on; check the mail page of both sent mails shows the image.
9. Replace your signature, then open the first sent mail: it still shows the old image.
10. As a second admin, confirm you cannot see the first admin's image.
11. With "Track opens" on, send with the signature: the open is still recorded, the tracking image is last.
