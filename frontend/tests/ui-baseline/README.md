# UI baseline screenshots

Pictures of every dashboard layout, so a styling change to one can be proven not to touch the others.

```bash
cd frontend
node tests/ui-baseline/capture.mjs --out ../docs/ui-baseline        # save screenshots + hashes.json
node tests/ui-baseline/capture.mjs --compare ../docs/ui-baseline    # render again, exit 1 if anything differs
node tests/ui-baseline/capture.mjs --compare ../docs/ui-baseline --only doctor,patient,employee,partner
```

It mounts the **real layout components** (admin panel with the real Appointments page, Super Admin Portal, employee,
partner, doctor, patient) with the app's real global CSS, at 1440px and 390px. Nothing in `src/` is changed or mocked:
only the sign-in contexts and the socket are replaced by fixed stand-ins (`stubContexts.mjs`), and every `/api/*` call
is answered inside the browser with an empty list. Any other network request is refused, so nothing can reach a real
server. Page content in the employee, partner, doctor and patient shots is a fixed placeholder; the layout around it
is what is being compared.

The `+admincss` doctor and patient shots load the admin stylesheets first, which is the worst case for a leak (a person
who visited an admin page and then a doctor or patient page in the same tab).

## What "identical" means

Chromium does not draw the same page the same way every time: a handful of pixels (gradients, anti-aliased edges of
rounded translucent boxes) move by 1-16 levels out of 255 between two renders of unchanged code. So a screen is
reported **identical** when its hash matches, or when no pixel moved by more than 24 levels and at most 150 pixels moved
by more than 2. A real change moves hundreds or thousands of pixels. The tool prints the noise it ignored, and a swapped
image is reported DIFFERENT (checked).

## Appointments table checks

```bash
node tests/ui-baseline/appointmentsTable.mjs     # screenshots in docs/ui-after/appointments-table + the checks below
```

Draws the Appointments page inside the real admin layout (made-up rows) as an admin and a super admin at 1920, 1440, 1280,
1100 and 390px, and fails if a width has sideways scroll, a clipped date, fee, status, booking ID or action cell, a row whose
buttons wrap onto two lines, a fixed column that is not its set width, or Patient, Doctor and Category that are not equal.
`tableChecks.mjs` holds the measurements; the Appointments browser tests use it too. `measure.mjs` prints where the page
content sits at several widths.

The `adminpage-*` screens (Dashboard, Manage Users, Support Tickets, Our Doctors) are other admin pages, there to show a change to the Appointments page leaves them alone.

## Admin sidebar and top bar checks

```bash
node tests/ui-baseline/adminShell.mjs                 # screenshots in docs/ui-after/shell-v2 + behaviour checks
node tests/ui-baseline/sidebarItems.mjs --compare ../docs/ui-baseline/sidebar-items.json   # the menu is exactly what it was
node tests/ui-baseline/capture.mjs --content-only --compare ../docs/ui-baseline --only admin,superadmin,paymentadmin,adminpage-dashboard,adminpage-users,adminpage-tickets,adminpage-doctors
node tests/ui-baseline/compareImages.mjs <folderBefore> <folderAfter>
```

`sidebar-items.json` is the menu as drawn before the redesign (every entry, submenu entry, link target and order, per role, with
and without Live Chat). `adminNav.test.mjs` holds the same lists as plain data. `--content-only` compares just the page-content
area of admin pages, so a change to the sidebar or top bar can be shown to leave the pages alone.
