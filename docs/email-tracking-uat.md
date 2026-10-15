# Email tracking v2: UAT deployment and test script

Branch: `feature/email-tracking-v2`. UAT only. Production stays as it is until approved.

## 1. Getting the branch onto UAT

The branch is `uat` plus its own commits (a fast-forward): nothing on `uat` is missing from it, and nothing
else comes with it.

```
git log --oneline uat..feature/email-tracking-v2        # review exactly what comes
git checkout uat
git merge --ff-only feature/email-tracking-v2           # no merge commit; fails if uat moved
git push origin uat                                      # you, when approved
```

Then deploy the backend and the frontend build to UAT as usual and restart the backend.

What changes for existing users once deployed (all behind switches that are off until you set them):

- the Sent filter "Open status" becomes **Read status** (the `openStatus` URL parameter is gone);
- company and Apple recipients are now tracked (before: never);
- a recipient on the opt-out list stops being recorded even for mail already sent;
- the footer notice is written automatically; an empty custom line is now allowed;
- new collections are created on first use: `emaillinks`, `emailclickevents`, `emaildownloadlinks`,
  `emaildownloadevents`. No migration. Existing mail keeps working (every new field has a default).

Before switching anything on, check that the reverse proxy forwards **`/api/l/*` and `/api/d/*`** to the
backend the same way it forwards `/api/e/*`:

```
curl -s -o /dev/null -w "%{http_code}\n" https://uat.humancareconnect.co/api/l/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa   # expect 404
curl -s -o /dev/null -w "%{http_code}\n" https://uat.humancareconnect.co/api/d/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa   # expect 404
curl -s -o /dev/null -w "%{http_code}\n" https://uat.humancareconnect.co/api/e/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.gif   # expect 200
```

A 404 from the backend ("This link has expired" page for `/d/`) is right. A frontend page or a 502 means the
proxy is not forwarding.

Rollback: set `EMAIL_TRACKING_ENABLED=false` and restart. Nothing new is added or recorded; links and
download links already in sent mail keep working. Data stays.

## 2. Environment variables on UAT

| Name | Value for UAT | Note |
|---|---|---|
| `EMAIL_TRACKING_ENABLED` | `true` | gate for everything below |
| `PUBLIC_TRACKING_BASE_URL` | `https://uat.humancareconnect.co` | https, no trailing path |
| `EMAIL_TRACKING_LINKS_ENABLED` | `true` | link click tracking |
| `EMAIL_SECURE_LINKS_ENABLED` | `true` | secure attachment links |
| `EMAIL_SECURE_LINK_DAYS_MAX` | `14` | cap on the expiry (default 30) |
| `EMAIL_TRACKING_IGNORE_IPS` | your office / VPN public addresses, comma separated | so your own clicks are ignored |
| `EMAIL_TRACKING_DEBUG_LOG` | `true` | tuning log, server log only |
| `EMAIL_TRACKING_DEBUG_UNTIL` | `2026-10-29T00:00:00Z` | must be in the future, at most 14 days ahead; it stops itself |
| `TRUST_PROXY` | the number of proxies in front of the backend | so the visitor's real address is seen |

Optional, with their defaults (set only to change them):

| Name | Default | Meaning |
|---|---|---|
| `EMAIL_TRACKING_GRACE_SECONDS` | `60` | loads this soon after sending are scanners |
| `EMAIL_TRACKING_DEDUPE_MINUTES` | `10` | repeat opens inside this are not counted again |
| `EMAIL_SECOND_HIT_MINUTES` | `2` | scanner-looking hit counts if another follows this much later |
| `EMAIL_CLICK_BURST_LINKS` | `3` | this many different links ... |
| `EMAIL_CLICK_BURST_SECONDS` | `5` | ... within this many seconds is a scanner |
| `EMAIL_TRACKING_RATE_PER_MIN` | `60` | per-address limit on public tracking requests |
| `EMAIL_TRACKING_RETENTION_DAYS` | `180` | detail rows expire after this |
| `EMAIL_SCANNER_IPS` | empty | `vendor=range,vendor=range`, from the vendors' published lists |
| `EMAIL_APPLE_PROXY_IPS` | empty | extra Apple Mail Privacy Protection ranges |

The debug log refuses to run when `NODE_ENV=production`. If UAT runs with `NODE_ENV=production`, leave the
log off rather than changing `NODE_ENV`: it changes other behaviour.

## 3. Super Admin switches (Email, Settings, Mail IDs, "Open tracking" card)

1. **Allow open tracking**: On.
2. **Track mail to company addresses**: On (default).
3. **Record which links are clicked**: On.
4. **Let admins send attachments as secure links**: On; "Links expire after" `7` days.
5. **Notice in the footer**: leave the automatic wording; open "See the automatic wording" to read it.
6. Each Mail ID's "Track opens by default": as you like. The test script ticks the box per mail.

The card shows each gate as Active / Not active and says which one is missing.

## 4. Manual test script

Use one UAT Mail ID. Compose each test as a new mail (subject `UAT n - <inbox>`) and look at the **Sent**
list and the mail page ("Read status" box).

Body for every test mail:

```
UAT test. Link A: https://example.com/uat-a
Link B: www.example.org/uat-b
Link C: https://example.net/uat-c
```

Boxes: **Track opens** on; **Request read receipt** on for the receipt tests; **Send attachments as secure
links** only for the download tests (attach a small PDF with no personal data).

Check once first, on the compose form: the footer notice appears in the sent mail and says "opened" and
"which links ... clicked". Mail with no tracking has none.

### A. Gmail (personal account, browser)

| Step | Do | Expect |
|---|---|---|
| A1 | Send, open it in Gmail. | Within about 2 minutes: **Opened**. Opening again right away does not add to the count. |
| A2 | Click link A. | Page loads at once. Within a minute: **Clicked**, link A "1×", links B and C "Not clicked". |
| A3 | Send with secure links, click the file link. | File downloads. **Downloaded**, "1× downloaded", link valid until the date. |
| A4 | With read receipt on. | Gmail never sends one: "Requested, none received". |

### B. Outlook.com

| Step | Do | Expect |
|---|---|---|
| B1 | Send, open the mail without allowing images. | Still **Not opened yet** (images blocked). |
| B2 | Click "show images" / "download pictures". | **Opened**. |
| B3 | Click link B. | **Clicked**, link B "1×". |
| B4 | Settings, Mail, Read receipts: set to always send, then open a new receipt-requested mail. | **Read receipt** with the address and time. With "never", none. |

### C. Microsoft 365 company address (the important one)

| Step | Do | Expect |
|---|---|---|
| C1 | Send, **do not open**. Wait 5 minutes. Look at the Sent row. | Possibly **Only automatic loads seen** or **Not opened yet**: Defender scans at delivery. It must not read Opened or Clicked. |
| C2 | Check the link rows on the mail page. | Links A to C "Not clicked", even though Safe Links may have visited them. |
| C3 | Open the mail, click link A. | **Clicked** "1×" (counted once, not 3). |
| C4 | Send with a PDF as secure link, do not open. Wait, then download it yourself. | Not **Downloaded** until you download it. Then "1× downloaded". |
| C5 | Read receipt on, open in Outlook desktop and accept the prompt. | **Read receipt**. |

If C1 or C2 show Clicked or Downloaded from a scanner, read the debug log (section 5) and add the scanner's
range to `EMAIL_SCANNER_IPS`.

### D. Yahoo

| Step | Do | Expect |
|---|---|---|
| D1 | Send, open it (allow images if asked). | **Opened**. |
| D2 | Click link C. | **Clicked**. |

### E. Zoho

| Step | Do | Expect |
|---|---|---|
| E1 | Send, open without showing images. | **Not opened yet**. |
| E2 | Show images. | **Opened**. |
| E3 | Click link A. | **Clicked**. |

### F. iPhone Mail app

| Step | Do | Expect |
|---|---|---|
| F1 | Send to an `@icloud.com` address and do **not** open it. | **Opened (Apple — may be automatic)** shortly after delivery. Never a plain Opened. |
| F2 | Open it on the phone and tap link A. | **Clicked** (a click is a real action). |
| F3 | Send to a Gmail address read in the iPhone Mail app (Mail Privacy Protection on). | May show **Opened** without you opening it. This is a known limit: the hit is unlisted unless its address is in `EMAIL_APPLE_PROXY_IPS`. Note the debug log line. |

### G. Internal @humancareconnect.co address

| Step | Do | Expect |
|---|---|---|
| G1 | Start a mail to a colleague. | Under "Track opens": "Includes our own staff. An open may be a colleague, not the client." |
| G2 | Send, colleague opens it. | **Opened (may include our own staff)**. |
| G3 | Super Admin switches "Track mail to company addresses" off, send again. | **Tracking unavailable** (company recipient). |

### H. Opt-out

| Step | Do | Expect |
|---|---|---|
| H1 | Send a mail to the Gmail test address. | Works as in A. |
| H2 | Add that address to "Never track these recipients". Open the old mail again and click a link. | Link opens normally. Nothing new is recorded. |
| H3 | Send a new mail to the same address. | No tracking image or tracked links, no notice. **Tracking unavailable**. |
| H4 | Remove the address from the list. | Tracking works again on new mail. |

### I. Scanner behaviour (from a phone on mobile data, not your office network)

Take the three tokens from a test mail: in the received mail, copy a link address. Replace `<TOKEN>`.

```
# redirects, never counted: scanner user agent
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -A "Mimecast" https://uat.humancareconnect.co/api/l/<TOKEN>
# redirects, never counted: HEAD
curl -s -I -o /dev/null -w "%{http_code}\n" https://uat.humancareconnect.co/api/l/<TOKEN>
# image requested by a scanner: should become "Only automatic loads seen" on a fresh mail
curl -s -o /dev/null -A "Mimecast" https://uat.humancareconnect.co/api/e/<IMAGE-TOKEN>.gif
```

| Step | Do | Expect |
|---|---|---|
| I1 | The three commands above. | `302` with the destination for the first two. Sent row unchanged by them. The image call on a fresh mail gives **Only automatic loads seen**. |
| I2 | Request 3 different links within 5 seconds with a browser user agent (run three `curl -A "Mozilla/5.0 Chrome/126"` back to back, after the first minute). | None counted: the burst rule. |
| I3 | One link with a browser user agent, after the first minute. | Counted: **Clicked**. |
| I4 | A secure link with `-A "Mimecast"`. | The file is delivered (HTTP 200), not counted. |

### J. Secure link expiry

| Step | Do | Expect |
|---|---|---|
| J1 | Set the expiry in the database to now (UAT only): `db.emaildownloadlinks.updateMany({ message: ObjectId("<mail id>") }, { $set: { expiresAt: new Date() } })`. | The mail page says "link expired". |
| J2 | Open the link. | Plain page "This link has expired". No file. |
| J3 | The admin dashboard still lists the file and can download it. | Yes: the stored copy stays for records. |

### K. Replied beats everything

Reply to a test mail from the Gmail account. Expect **Replied** in the Sent list, with Opened, Clicked and
Downloaded still listed in the details.

## 5. The tuning log

While `EMAIL_TRACKING_DEBUG_LOG` is on and before `EMAIL_TRACKING_DEBUG_UNTIL`, the backend log has lines like

```
[email-tracking-debug] open ip=198.51.100.7 ua=Chrome verdict=counted
[email-tracking-debug] click ip=198.51.100.8 ua=Scanner verdict=scanner_ua
```

for hits no list recognised. After the tests, an address that clicked or opened inside seconds of delivery
and that you did not use is a scanner: put its range in `EMAIL_SCANNER_IPS` as `vendor=range`. Then turn the
log off (or let it expire). Nothing is written to the database.

## 6. Done when

- every step above shows what is expected, or the difference is understood and written down;
- no scanner shows as Clicked, Downloaded or a plain Opened;
- the footer notice reads correctly in the sent mail for opens, links, downloads and receipt;
- the debug log is off.

Only then decide about production. Production needs its own approval: the same switches, off by default.
