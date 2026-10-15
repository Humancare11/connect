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
