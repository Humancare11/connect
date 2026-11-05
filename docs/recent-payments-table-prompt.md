Payment Links page (frontend/src/pages/admin/PaymentLinks.jsx) ki "Recent Payments" table ka design badalna hai.
Ye sirf UI ka kaam hai. Backend, API ya data logic mat chhedo.

Bahut safely karo:
- Pehle plan mode me plan dikhao. Mere approve karne ke baad hi code change karna.
- Branch feature/payment-link-b2c pe hi kaam karo.
- Sirf Recent Payments table ka JSX aur uski CSS badlo. Payment History page, Manual Invoices page ya form ko mat chhedo.
- Koi existing button ya handler (Download, Send Email / Resend Email, Copy) delete ya rename mat karo. Sirf unki jagah badlegi.
- B2B ke comment kiye hue code ko mat chhedo.

## Reference
Mockup: C:\aaamain\connect\docs\recent-payments-table.html (browser me kholo). Styling existing PaymentLinks.css jaisi hi rakho.

## Naye columns (isi order me)
| # | Column | Kya dikhega |
|---|---|---|
| 1 | Sr No | 1, 2, 3… (list me row ka number, newest pehle) |
| 2 | Case Number | Invoice number (jaise HC14-2610). Invoice na ho to "-" |
| 3 | Name | Upar customer ka naam (bold). Neeche chhote grey text me email |
| 4 | Created | Upar date (28 Oct 2026). Neeche chhote grey text me time (12:33 pm) |
| 5 | Amount | Jaise abhi hai ($100.00, bold) |
| 6 | Status | Payment status pill (Paid / Pending / Expired), jaise abhi hai |
| 7 | Note | Jaise abhi hai, khali ho to "-" |
| 8 | Invoice | Sirf email status ("✓ Email sent" green ya "Email not sent" orange) aur neeche Download + Send Email / Resend Email buttons |
| 9 | Link | Copy button, jaise abhi hai |

## Hatana hai
- Invoice column se invoice number aur invoice ka Paid/Due pill hatao. Number ab "Case Number" column me hai, aur payment status "Status" column me.
- Invoice column se customer ka naam bhi hatao, ab wo Name column me hai.
- Email ka alag column nahi banana.

## Edge cases
- Purane links jinke paas invoice nahi hai: Case Number "-" dikhe. Invoice column me "Generate"/"Retry receipt" wala existing button waise hi rahe.
- Customer name/email na ho (purane links): Name me "-" dikhe.
- Lambi email wrap ho jaye, table ko chauda na kare.
- Mobile width pe table apne box ke andar horizontally scroll ho, page nahi.
- Date/time ke liye existing formatDate logic use karo. Bas date aur time do lines me dikhao. Timezone ka behaviour mat badlo.

## Tests
- Frontend unit/e2e tests update karo, taaki naye columns aur order check ho.
- Ek test ho ki Download, Send Email aur Copy buttons abhi bhi kaam karte hain.
- Ek test purane link ke liye (bina invoice / bina customer) jisme "-" dikhe aur page crash na ho.
- eslint clean ho aur `npm run build` pass ho.
- Backend tests ki zaroorat nahi, kyunki backend nahi badla. Agar badalna pade to pehle mujhse poochho.

## Phir
- Commit karo usi branch pe, push mat karna.
- Batao: kaunsi files badli, test results, aur page ka ek screenshot (desktop + mobile width).
