# INR (India) through Razorpay

Customers whose country is **India** pay in **rupees (₹)**, through **Razorpay only**. Everyone else is unchanged: EUR (43 countries) and GBP (7) and USD (all others) are paid with Stripe or PayPal.

## The safety switch

INR is active **only** when all three are true:

1. `MULTI_CURRENCY_ENABLED=true`
2. `RAZORPAY_KEY_ID` is set
3. `RAZORPAY_KEY_SECRET` is set

If any of them is missing, an Indian customer gets exactly today's behaviour: USD on Stripe / PayPal. The server never sends an Indian customer to Razorpay without keys. The flag is read on every request, so changing `.env` and restarting the backend is all it takes (no frontend rebuild for the flag or the keys).

## Environment variables

| Where | Variable | Meaning |
|---|---|---|
| backend `.env` | `MULTI_CURRENCY_ENABLED` | `true` turns EUR / GBP / INR on. Off by default. |
| backend `.env` | `RAZORPAY_KEY_ID` | Public key id (`rzp_test_...` in test mode). |
| backend `.env` | `RAZORPAY_KEY_SECRET` | Key secret. Server only. Never in a frontend file. |
| backend `.env` | `RAZORPAY_WEBHOOK_SECRET` | The secret you type when you add the webhook in the Razorpay dashboard. Without it the webhook answers 503. |
| frontend `.env.*` | `VITE_RAZORPAY_KEY_ID` | **Optional fallback.** The server returns the public key id with every order, so Checkout works without it. |

## How a rupee payment works

1. The server decides the currency (profile country first, then the IP). `GET /api/geo/currency` says `INR` for India.
2. The booking page shows ₹ prices and **only a Razorpay button** (Stripe and PayPal are hidden; the PayPal script is not loaded). The Razorpay Checkout script is loaded only when the button is clicked.
3. `POST /api/razorpay/create-order` with `{ priceType: "category", priceRef }` only. The server looks up the category's INR price and creates the order (amount in paise, currency INR, auto-capture, `notes: { priceType, priceRef, userId }`). The browser never sends an amount or a currency.
4. Checkout opens (name, email and phone are pre-filled). The customer pays by UPI, card, netbanking or wallet.
5. Checkout returns `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`. The booking request carries those three.
6. The server verifies: Razorpay is configured; `HMAC-SHA256(order_id|payment_id, key_secret)` equals the signature (timing-safe); the payment and the order are **fetched from Razorpay**: payment status `captured`, same order, currency INR, amount equal to the category's INR price in paise, not refunded, and the order was created for this customer.
7. `ConsumedPayment` (unique on gateway + payment id) makes one payment fund exactly one booking.
8. The booking stores `paymentGateway: "razorpay"`, `paymentCurrency: "inr"`, `razorpayOrderId`, `razorpayPaymentId`. The same ids go on the `Payment` and `Invoice`. The invoice and the email show ₹.

The gateway follows the currency: INR → Razorpay only; USD / EUR / GBP → Stripe or PayPal only. Any mismatch (Razorpay with USD, Stripe or PayPal with INR) is rejected both when an order is created and when a booking is verified.

A category with **no INR price** is charged in USD (labelled `$`) on Stripe / PayPal, like a missing EUR / GBP price. The customer is never sent to Razorpay for it. Fill in every INR price before relying on INR (`node scripts/checkCategoryCurrencyCoverage.js` lists what is missing).

## Capture mode

Orders are created with **auto-capture** (`payment_capture: 1`). The payment is `captured` the moment the customer pays; there is no authorize-then-capture step to forget. A payment left only `authorized` is rejected by the server ("not completed"). If the Razorpay account is set to manual capture in the dashboard, switch it to auto-capture in the dashboard's payment-capture settings, or the bookings will not be accepted.

## Webhook

`POST https://<your-domain>/api/razorpay/webhook`, signed with `RAZORPAY_WEBHOOK_SECRET` (`X-Razorpay-Signature`, HMAC-SHA256 of the raw body, compared in constant time). Subscribe to: `payment.captured`, `payment.failed`, `refund.processed` (also `refund.created`, `refund.failed` if you want them recorded).

- Idempotent: every delivery is stored under `X-Razorpay-Event-Id` (unique), a repeat is acknowledged and not handled twice.
- `payment.captured` is recorded; if no booking has used the payment yet the log says `[RAZORPAY_UNCLAIMED_CAPTURE] payment=pay_...`. It may just be about to be used; if no booking ever appears, the customer paid and did not get a booking: refund it in Razorpay.
- `refund.processed` adds the refunded amount to the matching `Payment` (`refundedAmountCents`, `refundedAt`). Partial refunds add up.
- It never changes a booking or a doctor payout. Refunds are made by hand in the Razorpay dashboard; the admin's cancel dialog says "Refund it in Razorpay" with the ₹ amount.

**Razorpay calls the webhook from the internet**, so the URL must be publicly reachable. Razorpay documents webhook URLs as HTTPS; I could not verify whether test mode also accepts plain `http://`. The payment flow itself (Checkout + signature verification) does **not** depend on the webhook, so a plain-http staging server can test everything except the webhook; use a tunnel (ngrok, Cloudflare Tunnel) or add SSL to test it.

## Test credentials (Razorpay Test mode)

Razorpay documents these for Test mode (check the current list on Razorpay's "Test card details" page, it can change):

- **UPI:** `success@razorpay` succeeds; `failure@razorpay` fails.
- **Cards:** any future expiry, any 3-digit CVV, any name. Domestic test cards: Mastercard `5267 3181 8797 5449`, Visa `4386 2894 0766 0153`. In the bank page that follows, choose **Success** (or **Failure** to test a failed payment).
- **Netbanking:** pick any bank, then **Success** or **Failure** on the test bank page.
- Closing the Checkout window without paying shows "Payment was cancelled. You have not been charged."

No real money moves in Test mode.

## Setting it up (test mode)

1. Create / log in to a Razorpay account → switch the dashboard to **Test mode** → **Account & Settings → API Keys → Generate Test Key**. Copy the **Key Id** and **Key Secret** (shown once).
2. Backend `.env`:
   ```
   MULTI_CURRENCY_ENABLED=true
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
   RAZORPAY_WEBHOOK_SECRET=a-long-random-string-you-choose
   ```
3. **Webhooks → Add New Webhook**: URL `https://<domain>/api/razorpay/webhook`, the same secret as `RAZORPAY_WEBHOOK_SECRET`, the events above.
4. Restart the backend (`pm2 restart hc-backend --update-env` on staging).
5. In Super Admin → Healthcare Management → Categories: open the **INR** tab, edit each category and fill in its INR price (the missing banner lists what is left).
6. **Rebuild the frontend once** after deploying this branch: `frontend/index.html` has a new Content-Security-Policy that lets `checkout.razorpay.com` load. Without the rebuild the Checkout window is blocked.

## Pricing rules (admin)

- A new category needs all four prices: USD, EUR, GBP, INR.
- Every price: more than 0, at most 2 decimals. Maximum 100,000 for USD / EUR / GBP and **10,00,000 for INR**.
- EUR / GBP / INR that are set can be changed but never cleared. One that was never set may stay empty (it falls back to USD).
- Nothing is converted between currencies.
- Minimum price: 0.01 for USD / EUR / GBP and ₹1 for INR (Razorpay's own minimum order is ₹1). Anything smaller is refused, on create and on edit. A sensible floor for a real consultation is ₹10, but the code only enforces ₹1.

## Reports

INR is its own bucket in Entries, the money boxes, the Appointments list and the CSV (`Currency` = `INR`). Rupees are never added to dollars, euros or pounds. Doctor payouts and manual entries are not affected (manual entries are USD only).
