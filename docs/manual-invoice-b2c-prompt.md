Do kaam hain, dono branch feature/payment-link-b2c pe. Pehle plan mode me plan dikhao, mere approve
karne ke baad hi code change karna. Push mat karna.

## Kaam 1: Recent Payments header (mobile fix)
Mobile (390px) pe Recent Payments ke header me "Recent Payments" title do line me toot raha hai, aur
Refresh button bahut chauda hai.
- Title ek line me rahe.
- Refresh button apne text jitna hi chauda ho, desktop jaisa.
- Sirf PaymentLinks.css me badlav karo.
- Mobile ka naya screenshot docs/samples/recent-payments-mobile.png me save karo.
- Commit karo.

## Kaam 2: Manual Invoices page ko B2C banao
Manual Invoices page (frontend/src/pages/admin/ManualInvoices.jsx) abhi B2B form hai. Ise Payment Links
ke B2C form jaisa banao.

Fark sirf ek: **Manual Invoice me payment link nahi banega.** Sirf invoice banega. Baaki pura flow
(PDF, download, email, history) complete hona chahiye.

### B2B ko comment karo, delete nahi
Jaise Payment Links me kiya tha:
- `const B2B_MANUAL_INVOICES_ENABLED = false; // TODO: enable B2B later`
- B2B ke saare fields (Company, Personal number, Country, Address, Postal code, Payment Terms, Due Date,
  Quantity/Rate) comment me rakho, har block pe `// B2B: disabled for now, re-enable later. Do not delete.`
- B2B ke tests delete mat karo, `test.skip` karo aur "B2B disabled for now" likho.

### Form (B2C)
Payment Links ke B2C form jaise hi fields aur design:
1. Full name*
2. Email*
3. Services: har line me Description + Amount (USD), "+ Add Item", remove (×). Neeche Total. Quantity
   nahi, har item ki quantity hamesha 1.
4. **Issue as:** "Due — not yet paid" ya "Paid — already received". Payment link nahi hai, isliye Paid
   ka option yahan chahiye.
5. Internal Note (optional).
6. Button: "Generate Invoice". Uske neeche hint:
   "Email apne aap nahi jayega. Invoice banne ke baad Send Email button se bhejiye."

Ho sake to Payment Links ka B2C form ka code ek shared component me nikaal ke dono pages pe use karo,
taaki do copy na banen. Agar ye risky lage to pehle mujhe batao.

### Backend
- POST /api/admin/manual-invoices: `customerType` lo. Default "b2c". B2C me sirf name, email,
  items (description + amount, qty 1, rate = amount) aur status (due/paid) validate karo.
  Wahi `normalizeB2cItems` use karo jo Payment Links me hai.
- B2B request aaye aur flag false ho to 400: "Business invoices are not enabled yet."
- Koi payment link create mat karo. `source` = "manual", `customerType` = "b2c".
- **PDF:** B2C manual invoice bhi `documentType: "consultation"` layout me bane, bilkul patient /
  B2C payment link invoice jaisa.
  - Due: "Amount Due" + "STATUS: DUE — ..." line. Manual invoice ke paas payment link nahi hai, isliye
    yahan text ho: "STATUS: DUE — Payment pending. Please contact us to complete payment."
  - Paid: "Total Paid" + "STATUS: PAID — Payment received in full. No balance outstanding."
- **Email:** manual invoice me bhi email apne aap NAHI jayega (abhi auto jata hai, ye badlega).
  Invoice banne pe `emailed: false`. "Send Email" / "Resend Email" se hi jaye. Email patient-style
  template ho, bina "Pay now" button ke.
- **Mark as Paid:** Due manual invoice pe "Mark as Paid" button rahe, jaise abhi hai. Paid karne pe PDF
  dobara "Paid" bane. Email apne aap na jaye, Send Email se bheja ja sake.
- Invoice number wahi shared counter (HCnn-YYMM).
- Purane B2B manual invoices list me dikhte rahen, unka download chale. Unka PDF waise hi rahe.

### History table (Manual Invoices page)
Recent Payments jaisa layout:
Sr No, Case Number (invoice number), Name (naam + neeche email), Created (date + neeche time),
Amount, Status (Paid / Due), Note, Invoice (email status + Download + Send Email / Resend Email +
Due ho to Mark as Paid).
Payment Links wala `RecentInvoiceCell` / helpers reuse karo agar fit ho.

### Dhyan rahe
- Manual Invoices page superadmin (`/admin-dashboard/manual-invoices`) aur paymentadmin
  (`/payment-admin/manual-invoices`) dono use karte hain. Dono pe B2C hi dikhe.
- Payment-link wale invoices Manual Invoices list me "Payment link" source ke saath dikhte hain, unpe
  Mark as Paid nahi. Ye waisa hi rahe.
- Patient appointment invoice aur Payment Links flow pe koi asar na ho. Snapshot tests pass hon.

### Tests
- B2C manual invoice create (due): 201, consultation layout, `emailed: false`, koi email call nahi,
  koi PaymentLink document nahi bana.
- B2C manual invoice create (paid): "Total Paid" + PAID status.
- Send Email: patient-style email jaye, `emailed: true`.
- Mark as Paid: due → paid, PDF dobara bane, email apne aap na jaye.
- Quantity na bheje ya 5 bheje: dono me qty 1.
- Flag false + b2b: 400.
- Purana B2B invoice: list me dikhe aur download chale.
- E2E: form me sirf B2C fields, history ke naye columns, Send Email aur Mark as Paid.
- eslint clean, `npm run build` pass, backend full suite.

### Phir
- Commit karo, push mat karna.
- Batao: badli files, test results, kya comment/skip kiya, aur kuch decide karna pada to wo.
- Screenshots docs/samples/ me: manual-invoice-form.png, manual-invoice-history.png.
- Sample PDFs docs/samples/ me: manual-invoice-b2c-due.pdf, manual-invoice-b2c-paid.pdf.
