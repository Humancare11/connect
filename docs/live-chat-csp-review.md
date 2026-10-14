# Live Chat: CSP security review and proposal

Docs only. No Content Security Policy was changed anywhere in this branch.

## What exists today

- `frontend/index.html` has a `<meta http-equiv="Content-Security-Policy">` at about line 88, after `</head>`. Browsers only honor it inside `<head>`, so it is ignored. The site currently runs without an effective CSP.
- Backend `server.js` has helmet's CSP commented out. Helmet protects the API only; the frontend is a Render static site.
- `render.yaml` sets X-Frame-Options, X-Content-Type-Options, Referrer-Policy and Permissions-Policy on the static site, but no CSP.

## What live chat needs from a CSP

| Directive | Needed |
|---|---|
| `script-src` | `https://challenges.cloudflare.com` (Turnstile) |
| `frame-src` | `https://challenges.cloudflare.com` |
| `connect-src` | `'self'` plus the API origin, and `wss://<api origin>` for Socket.IO |
| `img-src` | `'self' data:` (S3 files are opened in a new tab through presigned links, not embedded) |
| `style-src` | `'self' 'unsafe-inline'` (React inline styles) |

The Text widget needs additional LiveChat domains; those disappear when it is removed.

## Review notes on the chat code

- Patient and agent text is rendered as React text, never as HTML. No `dangerouslySetInnerHTML` in the live chat code.
- Files are never embedded; an agent opens them via a role-checked presigned URL in a new tab with the opener cleared.
- Sockets: admin namespace refuses non-admin roles on connect and per event, with per-IP caps, size limits and rate limits.
- The OpenAI call happens on the server only. The key is never sent to the browser.

## Proposal (report-only first)

Ship as an HTTP response header on the static site (Render `headers` in `render.yaml`), not the meta tag:

```
Content-Security-Policy-Report-Only:
  default-src 'self';
  script-src 'self' https://challenges.cloudflare.com;
  frame-src https://challenges.cloudflare.com;
  connect-src 'self' https://<api-origin> wss://<api-origin>;
  img-src 'self' data: https:;
  style-src 'self' 'unsafe-inline';
  font-src 'self' data: https://fonts.gstatic.com;
  base-uri 'self'; form-action 'self'; frame-ancestors 'self'
```

Steps: run report-only for two weeks, add the existing third parties it lists (analytics, fonts, maps), then switch to enforcing. Needs the owner's approval before any change because it affects the whole site.
