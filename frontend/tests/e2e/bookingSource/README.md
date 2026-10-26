# Booking source: browser test

Real Chromium drives the real `Header`, a real condition page (PCOS), the real booking form (`AppointmentBookingForm`) and
the real `createAppointment` code over a throwaway in-memory MongoDB replica set. See `bookingSource.e2e.test.mjs`.

```bash
cd frontend
npm run test:e2e:booking-source
```

Stubbed: payment (Stripe and PayPal are replaced by stand-ins in `harness/` that always succeed, and the server treats the
payment reference as a succeeded $50 payment), the invoice ledger and the notification mails, login (one fixed patient),
and the picker page between the header and the form (a small page with one button that does what the real picker does:
`navigate()` to the form's URL).

It skips itself, saying why, when Chromium or the backend's dependencies are missing. Needs the same things as
`tests/e2e/adminAppointments/README.md`.
