# Live Chat module: original brief

Saved verbatim from the project owner. Read this at the start of every phase. The approved plan, with answers and corrections, is in `docs/live-chat-plan.md`. If the two disagree, the plan wins.

---

You are adding a Live Chat module to Humancare Connect (humancareconnect.co), a US telehealth platform. Read this whole brief first.

IMPORTANT: right now you only plan. Until I reply "approved": do not create, edit, move or delete any file; do not install packages; do not run migrations, builds, deploys or any command that changes the project, database or server. Only read files and run read-only commands (ls, cat, git status, git log, git branch, reading configs).

BRANCH: all live-chat work happens only on the git branch `chat`. From Phase 1 on, create it from the latest main if it doesn't exist and switch to it. Never commit to, merge into or push to main/master, and never deploy. I will review and merge the branch myself.

REFERENCE
- docs/chat-demo.html is a working UI prototype with fake data and no backend. It is the source of truth for screens, layout, wording (English), colours and behaviour. Reuse its look; do not ship its simulation code.
- The site already has: Node/Express 5 (CommonJS) backend, React 19 + Vite frontend (public pages prerendered), MongoDB via Mongoose, Socket.IO 4.8 on the same server with cookie auth, adminToken + verifyAdminToken/adminOnly, S3 uploads (utils/uploadStorage.js), message encryption (chatCrypto.js), DB-IP City Lite lookup (utils/geoIp.js), rate limiters (rateLimiters.js), RetentionPolicy + retentionJobs.js, AdminLayout.jsx with NAV_ITEMS. Reuse these. The Email module is a good template.
- The site currently embeds the Text (LiveChat) widget. Plan how to remove it once ours is live.

STEP 0 (read-only)
1. Run git status and git branch and tell me the current branch. Confirm the stack details above and anything that differs.
2. Reply in chat (no files) with your implementation plan: models, API routes, socket namespaces and events, React components, every EXISTING file you will change and why, new packages, env vars, phases, tests, risks, and your questions.
3. Stop and wait for "approved".

WHO CHATS
- Only admin-panel users with roles admin and superadmin (employeeadmin only if I confirm) act as live agents. Doctors, patients and partners never see the inbox. Check the role on every route and every socket event.
- Each agent has an Online/Offline switch and a display name shown to patients (e.g. "Sam").

PATIENT WIDGET (public pages only; not admin, login, payment or video-call pages)
- Floating "Chat with us" button bottom-right; window ~380x600 on desktop, full screen on mobile. Header: avatar with online dot, "Humancare AI" / "AI Healthcare Coordinator", minimize and close. Once the AI chat has started, the header also shows a "Talk to live agent" button (hidden before the contact form and while waiting for or talking to an agent).
- Mount client-side only, after idle, so prerender/SEO/LCP are unaffected.
- STEP 1 contact form, before ANY chat (AI or live agent): Full name (required), Email (required, validated), Phone (optional; if given, 7-15 digits with country code). Consent line linking the Privacy Policy. The message box stays disabled until the form is submitted. Remember the contact for this visitor so returning visitors skip the form.
- STEP 2 after submit: greeting "Hi {first name}! Welcome to Humancare Connect. I'm Humancare AI, your healthcare coordinator. How can I help you today?" followed by quick-option cards (icon, label, chevron):
  1. Online Consultation with Prescription
  2. Prescription & Prescription refill
  3. Medical Advice/Second Opinion
  4. Sick Notes
  5. Others
  6. Talk to a live agent
  Clicking an option sends its label as the patient's message and the AI replies for that topic. Once one is picked, the cards disappear. There are no option chips above the message box. Options and topic replies are editable in AI settings.
- "Talk to a live agent" (quick option, header button, or AI handoff) moves the chat to the live-agent queue straight away; contact details are already known, so no second form. Header shows "Connecting you with a live agent…", then the agent's name.
- If no agent is online or it's outside support hours: tell the patient, save the request, and say the team will reply by email.
- If an admin starts a chat with a visitor who never opened the widget, show a message bubble above the launcher with Reply / Later. The visitor must fill the contact form before replying.
- File upload for reports (pdf/jpg/png, max 10 MB) to S3, admin-only access via presigned URLs.
- After resolve: 1-5 star rating, and a "Start a new chat" button.
- Persist the visitor with a first-party id so the chat survives page changes and return visits.
- Footer line: chat messages and, with consent, visited pages are used to provide support.

VISITOR TRACKING
- Only after the visitor accepts cookies. Report visitor id, page path + title, page changes, time on page, referrer, device, OS, browser. Server adds IP and city/state/country via utils/geoIp.js.
- Visitors who never chat are kept in memory for the live list only, not stored in MongoDB.
- When the tab closes, remove the visitor within ~30 s; archive any open chat as "patient left".

ADMIN PANEL: new "Live Chat" group (NEW badge) in the existing navy sidebar, same top bar and card style.
1. Real-time visitors: stat cards (on website now, chatting, waiting for agent, with AI agent); Care radar for visitors stuck >4 min on the booking page without booking; filters; live table (name or IP, activity, Start chat / View chat / Join, assigned to, current page, ticking time on site, city, state, country, source); search by name, email, IP, city.
2. AI chats: conversations handled only by the AI. Admins can read live; any admin reply or "Take over" moves the chat to Live agent chats.
3. Live agent chats: Queue (waiting), My chats, Archived. A chat that was ever live stays here.
   Chat pages are 3 columns: list | conversation | patient panel. Conversation: AI/agent/system labels, typing indicator only (never draft text), Take over / Hand back to AI / Resolve, Reply vs Internal note tabs (notes never reach the patient), canned replies, "Suggest a reply".
   Patient panel with collapsible sections (remember open/closed): header (name/IP, status), email, phone, location, patient's local time, counts (chats, tickets, visits), First visit/Returning; Qualification (edit contact); Customer context (topic, source, cookie status, AI summary); Chat info (assignee, chat id, live duration, started on page); Chat tags; Recent conversations; Visited pages timeline (title, URL, time on each); Visit info (device, OS, browser, referrer, visit duration, IP, location).
4. Team: agents with role, display name, status, open chats, chats today, avg first reply; plus the AI agent row.
5. Reports: chats today, % solved by AI, first reply time, rating, bookings after chat, chats per hour (AI vs agent).
6. AI agent settings: mode (AI first / AI only when no agent available / AI off), handoff rules, support hours (US time zone), offline rule (outside hours OR no agent online), greeting, quick options and their replies, business facts the AI may use, agent display name.
- Notifications: unread badges per page, toast + sound for new chats, new messages and queue entries, browser notifications if allowed.

AI
- Provider OpenAI, model from env LIVECHAT_MODEL=gpt-6-luna, key from LIVECHAT_OPENAI_API_KEY. Keep provider and model configurable so we can switch later. Server-side only; stream replies if practical.
- System prompt: answer only about Humancare services, prices, booking, prescriptions, sick notes, lab requisitions, second opinions, insurance and privacy, using the facts from AI settings; current prices: General consultation $49, Mental health support $49, Doctor notes & sick notes $49, Lab requisitions $49, Chronic care management $55, Prescription refills $60, Second medical opinion $60, Fit to fly $69. Never diagnose, never suggest medication or doses; suggest a visit with a licensed doctor instead. Keep answers short. Respond in the patient's language.
- Return structured output (e.g. handoff true/false, reason, topic) so the server, not text matching, decides on handoff.
- Credits are prepaid with auto-reload off. On an insufficient-credit/quota error, do not show an error: switch the widget to "Our AI assistant is unavailable right now. Talk to a live agent or leave a message and we'll email you." Keep live chat working and alert admins once.
- Log tokens per chat.

ABUSE PROTECTION
- Cloudflare Turnstile (or reCAPTCHA) and a honeypot field on the contact form.
- Per visitor: max 30 AI replies per chat, max 6 messages per minute. Per IP: max 5 new chats per day. Max 1,000 characters per patient message, max 300 output tokens per AI reply.
- Daily AI spend cap in code (configurable, default $3) that switches to leave-a-message mode; live chat keeps working.
- Per-IP socket connection caps and event size limits. Admin alert plus an IP block button for abusive visitors.

SECURITY AND COMPLIANCE (HIPAA)
- Chat content is PHI. Encrypt message text with chatCrypto, never log message text, email or phone, no public file URLs, HTTPS/WSS only.
- Offline/follow-up emails must not contain health details.
- Retention: chats, messages, files and contacts 12 months (configurable via RetentionPolicy).
- Remind me before go-live to sign BAAs with OpenAI and confirm existing BAAs for AWS, MongoDB hosting and the email provider, and to check production admin accounts.

DELIVERY
- Follow existing conventions; Mongoose models in backend/models/ (ChatMessage is taken, pick another name).
- Plan for these 5 build phases: 1) foundation, models, sockets, consent tracker, Real-time visitors; 2) patient widget, contact form, quick options, header live-agent button, AI, abuse limits; 3) admin chat workspace (AI chats, Live agent chats, patient panel); 4) files, rating, admin-started chats, offline and AI-unavailable fallbacks, visitor-left, notifications; 5) Team, Reports, AI settings, retention, privacy lines, docs, tests, Text widget removal.
- Build phase by phase. Before each phase, list files to add/change and wait for my OK. After each phase, run and test it, then tell me what changed and what to check.
- Tests (node --test): contact form gate, option click flow, AI chats moving to Live agent chats, visitor leaving archives the chat, admin-only access on routes and sockets, credit-exhausted fallback, rate limits.
- Write docs/live-chat.md: setup, env vars, enabling the widget, editing AI facts and options, removing the Text widget.
