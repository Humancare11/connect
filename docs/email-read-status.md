# Email: what "Read status" means

Every mail sent from the dashboard shows **one** status in the Sent list and on the mail page. It is the
strongest signal we have for that mail. **None of them proves a person read the mail.**

The mail page also lists every signal behind the status (what, when, how many times) and has a
"What do these statuses mean?" box with the same text as below.

## The statuses, strongest first

| Status | What happened | Where it can be wrong |
|---|---|---|
| **Replied** | The client answered in the same conversation. | Says nothing about other recipients. |
| **Downloaded** | Someone used a secure download link. | A security scanner that looks like a normal browser from an address we do not know can still count. |
| **Clicked** | Someone used a link in the mail. | Same: an unknown scanner can still count. Scanners that open every link at delivery are filtered. |
| **Read receipt** | The recipient's mail app confirmed the mail was displayed. | Very few mail apps send one, and the recipient can decline. Gmail never sends one. |
| **Opened** | The recipient's mail app loaded our tiny tracking image. | A preview pane, a scanner or an image setting can load it without a person reading. Gmail loads it once, sometimes at delivery. |
| **Opened (Apple — may be automatic)** | Apple Mail loaded the image for the recipient. | Apple loads images itself (Mail Privacy Protection), so this often happens without anyone opening the mail. We do not treat it as a plain Opened. |
| **Not opened yet** | Nothing loaded the image. | Many mail apps (Outlook, company mailboxes) block images until the recipient allows them, so a read mail can show this. |
| **Only automatic loads seen** | Only scanners, previews or prefetch loaded the image. | The recipient may or may not have opened it. |
| **Tracking unavailable** | Tracking was not on for this mail: switched off, a recipient opted out, sent from Gmail directly, or an older mail. | Nothing can be said either way. |

"Not opened yet" and "Tracking unavailable" are different on purpose: a mail we could not track must never
look unread.

## Good to know

- **More than one recipient:** the image is shared, so we cannot tell which recipient opened or clicked.
  The screen says "by at least one recipient".
- **Company addresses:** mail with an `@humancareconnect.co` recipient is tracked, but an open may be a
  colleague. The screen says "may include our own staff".
- **Signature links:** a link in an admin's signature is tracked like any other link, so a click on it
  (for example the website) also shows **Clicked**. The mail page lists each link with its count.
- **Time:** the first load within about a minute of sending is treated as a scanner. A scanner-looking load
  counts as an open only if another follows two or more minutes later.
- **Read receipts** are asked for per mail and are the recipient's choice. "Requested, none received" is the
  normal outcome.
- **Secure links** are for non-sensitive files. Anyone with the link can download until it expires (7 days by
  default). Do not use them for medical reports, prescriptions or ID documents.
- **Asking us to stop:** recipients are told in the Privacy Policy and can write to the privacy contact. Add
  them to *Never track these recipients* in the tracking settings. From then on nothing is recorded for them, including on mail already sent, and links in
  old mail keep working.
- **What is stored:** counts, times and the link or file involved. No IP address and no browser details
  beyond a short family name (for example "Chrome"). Detail rows expire after 180 days; the summary stays.

## Footer notice

**No notice is added to mail by default.** Recipients are informed through the website Privacy Policy. A Super
Admin can switch "Add a tracking notice to the footer" on; then every mail that is tracked in any way carries
a notice that names exactly what that mail does (opens, links if it has some, download links, read receipt)
and ends with how to stop. The settings page shows the wording for every combination. Mail that is not
tracked never carries one.

Two things a recipient does see even without a notice: a read-receipt request makes their mail app ask
permission (the compose form says so), and hovering over a link shows our address instead of the destination.
