# HumanCare Connect Backend API Reference

A complete API reference for mobile app developers integrating with the HumanCare Connect backend.

## Base URLs
- Production: `https://humancareconnect.co/api`
- Local development: `http://localhost:5000/api`

## Authentication

### Tokens
The backend accepts authentication via:
- HttpOnly cookie
  - `userToken`, `doctorToken`, `adminToken`
- Bearer header
  - `Authorization: Bearer <token>`

### Refresh tokens
- Stored in HttpOnly cookies: `userRefreshToken`, `doctorRefreshToken`, `adminRefreshToken`
- Access token lifetime: 15 minutes
- Refresh token lifetime: 8 hours

### Protected route middleware
- `verifyToken`: any authenticated user / doctor / admin
- `verifyUserToken`: authenticated patient user only
- `verifyDoctorToken`: authenticated doctor only
- `verifyAdminToken` + `adminOnly`: admin or superadmin only
- `verifyAdminToken` + `superAdminOnly`: superadmin only
- `verifyAdminToken` + `paymentAdminOnly`: paymentadmin or superadmin only

### Error format
Most endpoints return error responses in one of these formats:
```json
{ "msg": "..." }
```
or
```json
{ "message": "..." }
```

Common status codes:
- `200` OK
- `201` Created
- `400` Bad Request
- `401` Unauthorized
- `402` Payment Required / payment failed
- `403` Forbidden
- `404` Not Found
- `409` Conflict
- `500` Internal Server Error

---

## 1. Authentication & User Account

### POST /api/auth/send-register-otp
Send OTP for user registration.

Request body:
```json
{ "email": "patient@example.com" }
```

Response:
```json
{ "msg": "OTP sent to your email." }
```

---

### POST /api/auth/register
Register a new user using OTP.

Request body:
```json
{
  "name": "Jane Doe",
  "email": "patient@example.com",
  "password": "StrongPass123!",
  "mobile": "555-1234",
  "dob": "1990-06-05",
  "gender": "female",
  "country": "USA",
  "otp": "123456",
  "privacyConsent": true,
  "hipaaConsent": true
}
```

Response:
```json
{
  "msg": "Registration successful.",
  "user": { "_id": "...", "name": "Jane Doe", "email": "patient@example.com", "role": "user", ... },
  "accessToken": "...",
  "refreshToken": "..."
}
```

---

### POST /api/auth/login
User login.

Request body:
```json
{ "email": "patient@example.com", "password": "StrongPass123!" }
```

Response:
```json
{
  "msg": "Login successful.",
  "user": { "_id": "...", "name": "Jane Doe", "email": "patient@example.com", "role": "user", ... },
  "accessToken": "...",
  "refreshToken": "..."
}
```

---

### POST /api/auth/refresh
Refresh the session.

Request headers / cookies:
- `Authorization: Bearer <refreshToken>`
- or refresh cookie stored in browser/app session

Response:
```json
{ "msg": "Session refreshed.", "accessToken": "...", "refreshToken": "..." }
```

---

### POST /api/auth/logout
Logout current user and clear cookies.

Response:
```json
{ "msg": "Logged out." }
```

---

### GET /api/auth/me
Get the authenticated patient profile.

Requires: `verifyUserToken`

Response:
```json
{ "user": { "_id": "...", "name": "Jane Doe", "email": "patient@example.com", "role": "user", ... } }
```

---

### POST /api/auth/send-forgot-otp
Send password reset OTP.

Request body:
```json
{ "email": "patient@example.com" }
```

Response:
```json
{ "msg": "Password reset OTP sent to your email." }
```

---

### POST /api/auth/verify-forgot-otp
Verify password reset OTP.

Request body:
```json
{ "email": "patient@example.com", "otp": "123456" }
```

Response:
```json
{ "msg": "OTP verified.", "resetToken": "..." }
```

---

### POST /api/auth/reset-password
Reset user password.

Request body:
```json
{ "resetToken": "...", "newPassword": "NewStrongPass123!" }
```

Response:
```json
{ "msg": "Password reset successfully." }
```

---

### POST /api/auth/google
Google sign-in for patients.

Request body:
```json
{
  "accessToken": "<google_access_token>",
  "mobile": "555-1234",
  "dob": "1990-06-05",
  "gender": "female",
  "country": "USA",
  "privacyConsent": true,
  "hipaaConsent": true
}
```

Response:
- Existing user login or new registration
- returns user info and session tokens

---

### POST /api/auth/google-doctor
Google sign-in for doctors.

Request body:
```json
{ "accessToken": "<google_access_token>" }
```

Response:
- doctor info and session tokens

---

### POST /api/auth/admin-login
Admin / superadmin login.

Request body:
```json
{ "email": "admin@example.com", "password": "AdminPass123!" }
```

Response:
```json
{ "msg": "Login successful.", "user": { ... } }
```

---

### POST /api/auth/payment-admin-login
Payment admin login.

Request body:
```json
{ "email": "paymentadmin@example.com", "password": "PaymentPass123!" }
```

---

### POST /api/auth/admin-logout
Logout admin/payment admin.

Response:
```json
{ "msg": "Logged out." }
```

---

### GET /api/auth/admin-me
Get current admin profile.

Requires: `verifyAdminToken`

Response:
```json
{ "user": { "_id": "...", "name": "Admin", "email": "admin@example.com", "role": "admin", ... } }
```

---

### PUT /api/auth/update-profile
Update patient profile.

Requires: `verifyUserToken`

Request body:
```json
{
  "name": "Jane Doe",
  "email": "patient@example.com",
  "mobile": "555-1234",
  "dob": "1990-06-05",
  "gender": "female",
  "country": "USA"
}
```

Response:
```json
{ "msg": "Profile updated successfully.", "user": { ... } }
```

---

### PUT /api/auth/change-password
Change patient password.

Requires: `verifyUserToken`

Request body:
```json
{ "currentPassword": "OldPass123!", "newPassword": "NewPass123!" }
```

Response:
```json
{ "msg": "Password changed successfully." }
```

---

## 2. Doctor Portal

### POST /api/doctor/send-register-otp
Send doctor registration OTP.

Request body:
```json
{ "email": "doctor@example.com" }
```

Response:
```json
{ "message": "OTP sent to your email." }
```

---

### POST /api/doctor/register
Doctor registration with OTP.

Request body:
```json
{
  "name": "Dr. Jane Smith",
  "email": "doctor@example.com",
  "password": "DoctorPass123!",
  "confirmPassword": "DoctorPass123!",
  "otp": "123456"
}
```

Response:
```json
{
  "message": "Doctor registered successfully.",
  "doctor": { "id": "...", "doctorId": 12345, "name": "Dr. Jane Smith", "email": "doctor@example.com", "isEnrolled": false }
}
```

---

### POST /api/doctor/login
Doctor login.

Request body:
```json
{ "email": "doctor@example.com", "password": "DoctorPass123!" }
```

Response:
```json
{
  "message": "Login successful.",
  "doctor": { "id": "...", "doctorId": 12345, "name": "Dr. Jane Smith", "email": "doctor@example.com", "isEnrolled": false }
}
```

---

### POST /api/doctor/send-forgot-otp
Doctor forgot password OTP.

Request body:
```json
{ "email": "doctor@example.com" }
```

---

### POST /api/doctor/verify-forgot-otp
Verify doctor reset OTP.

Request body:
```json
{ "email": "doctor@example.com", "otp": "123456" }
```

Response:
```json
{ "message": "OTP verified.", "resetToken": "..." }
```

---

### POST /api/doctor/reset-password
Reset doctor password.

Request body:
```json
{ "resetToken": "...", "newPassword": "NewDoctorPass123!" }
```

---

### POST /api/doctor/logout
Logout authenticated doctor.

Requires: `verifyDoctorToken`

Response:
```json
{ "message": "Logged out." }
```

---

### GET /api/doctor/me
Get authenticated doctor profile.

Requires: `verifyDoctorToken`

Response:
```json
{ "doctor": { "id": "...", "doctorId": 12345, "name": "Dr. Jane Smith", "email": "doctor@example.com", "isEnrolled": false } }
```

---

### GET /api/doctor/enrollment/:doctorId
Get doctor enrollment.

Requires: `verifyDoctorToken`

Response:
- enrollment object

---

### POST /api/doctor/enrollment
Submit or update enrollment.

Requires: `verifyDoctorToken`

Request body:
- `doctorId`
- enrollment fields such as `firstName`, `surname`, `email`, `specialization`, `qualification`, `consultantFees`, `clinicName`, `clinicAddress`, `availability`, `paypalId`, `payoutEmail`, `stripeAccountId`, etc.

Response:
```json
{ "message": "Enrollment submitted successfully", "enrollment": { ... } }
```

---

### PATCH /api/doctor/enrollment/progress
Save enrollment progress.

Requires: `verifyDoctorToken`

Request body:
```json
{ "doctorId": "...", "completedSteps": 3, "currentStep": 4 }
```

Response:
```json
{
  "message": "Progress saved",
  "enrollment": { "completedSteps": 3, "currentStep": 4, "currentStepLabel": "Payout", "applicationStatus": "Pending" }
}
```

---

### POST /api/doctor/profile-delete-request
Request doctor profile deletion.

Requires: `verifyDoctorToken`

Request body:
```json
{ "reason": "I want to remove my profile." }
```

Response:
```json
{ "message": "Profile delete request sent to admin for approval.", "enrollment": { ... } }
```

---

### PATCH /api/doctor/enrollment/:doctorId/consultation-fee
Update consultation fee.

Requires: `verifyDoctorToken`

Request body:
```json
{ "consultantFees": 120 }
```

Response:
```json
{ "message": "Consultation fee updated.", "consultantFees": 120 }
```

---

### GET /api/doctor/profile/:doctorId
Public doctor profile lookup by numeric 5-digit doctorId.

Response:
- approved doctor profile summary

---

### GET /api/doctor/approved
Public list of approved doctors.

Response:
- array of doctor overview objects

---

### GET /api/doctor/:id
Public approved doctor information by enrollment ID.

Response:
- approved doctor object

---

## 3. Appointments

### POST /api/appointments
Book a new appointment.

Requires: `verifyUserToken`

Request body:
```json
{
  "doctorId": "643...",
  "date": "2026-06-10",
  "time": "14:30",
  "problem": "Headache and nausea",
  "medicalReports": ["https://.../api/uploads/abc.pdf"],
  "paymentIntentId": "pi_...",
  "paypalOrderId": "ORDER123"
}
```

Note: At least one of `paymentIntentId` or `paypalOrderId` is required.

Response:
```json
{ "msg": "Appointment booked successfully.", "appointment": { ... } }
```

---

### GET /api/appointments/mine
Get current user appointments.

Requires: `verifyUserToken`

Response:
- array of appointments

---

### GET /api/appointments/doctor
Get appointments for authenticated doctor.

Requires: `verifyDoctorToken`

Response:
- array of doctor appointments

---

### GET /api/appointments/booked-slots
Get booked slots for a doctor on a date.

Requires: `verifyUserToken`

Query params:
- `doctorId`
- `date`

Response:
```json
{ "slots": ["14:30", "15:00"] }
```

---

### GET /api/appointments/admin/all
Get all appointments for admin.

Requires: `verifyAdminToken`, `adminOnly`

Response:
- array of appointments with patient and doctor details

---

### PUT /api/appointments/:id/change-doctor
Reassign doctor for an appointment.

Requires: `verifyAdminToken`, `adminOnly`

Request body:
```json
{ "doctorId": 12345 }
```

Response:
```json
{ "msg": "Doctor reassigned successfully.", "appointment": { ... } }
```

---

### PUT /api/appointments/:id/confirm
Doctor confirms appointment.

Requires: `verifyDoctorToken`

Response:
```json
{ "msg": "Appointment confirmed.", "appointment": { ... } }
```

---

### PUT /api/appointments/:id/complete
Doctor completes appointment.

Requires: `verifyDoctorToken`

Response:
```json
{ "msg": "Appointment marked as completed.", "appointment": { ... } }
```

---

### PUT /api/appointments/:id/cancel
Doctor cancels appointment.

Requires: `verifyDoctorToken`

Response:
```json
{ "msg": "Appointment cancelled.", "appointment": { ... } }
```

---

### GET /api/appointments/doctor/:id
Doctor fetches own appointment.

Requires: `verifyDoctorToken`

---

### GET /api/appointments/patient/:id
Patient fetches own appointment.

Requires: `verifyUserToken`

---

### GET /api/appointments/:id
Get appointment by ID.

Requires: `verifyToken`

Accessible by:
- appointment patient
- appointment doctor
- admin / superadmin

Response:
- appointment object

---

## 4. Uploads

### POST /api/upload
Upload a file.

Requires: `verifyToken`

Form data:
- `file` (multipart form upload)

Response:
```json
{
  "url": "https://humancareconnect.co/api/uploads/filename.ext",
  "name": "originalname.ext",
  "type": "application/pdf",
  "size": 12345
}
```

Allowed file types:
- images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- documents: `.pdf`, `.txt`, `.doc`, `.docx`, `.xls`, `.xlsx`

---

### GET /api/uploads/:filename
Download protected upload.

Requires: `verifyToken`

Response:
- file stream if authorized

Errors:
- `403` access denied
- `404` not found
- `500` if fallback or storage error

---

## 5. Q&A

### POST /api/qna/ask
Submit a new question.

Requires: `verifyUserToken`

Request body:
```json
{
  "question": "What should I do about my headache?",
  "category": "General",
  "attachments": ["https://.../api/uploads/abc.pdf"]
}
```

Response:
- created question object

---

### GET /api/qna/
Public approved questions.

Response:
- array of approved questions

---

### GET /api/qna/user-questions
Authenticated user's questions.

Requires: `verifyUserToken`

---

### GET /api/qna/admin/all
Admin list of all questions.

Requires: `verifyAdminToken`, `adminOnly`

---

### GET /api/qna/doctor/assigned
Doctor assigned questions.

Requires: `verifyDoctorToken`

---

### PUT /api/qna/:id/assign
Assign question to doctor.

Requires: `verifyAdminToken`, `adminOnly`

Request body:
```json
{ "doctorId": "...", "doctorName": "Dr. Jane Smith", "doctorSpec": "Cardiology" }
```

---

### PUT /api/qna/:id/answer
Doctor answers a question.

Requires: `verifyDoctorToken`

Request body:
```json
{ "answer": "...", "doctorName": "Dr. Jane Smith", "doctorSpec": "Cardiology" }
```

---

### PUT /api/qna/:id/approve
Admin approves a question.

Requires: `verifyAdminToken`, `adminOnly`

---

## 6. Medical Records

### GET /api/medical/patients
Doctor fetches distinct completed-appointment patients.

Requires: `verifyDoctorToken`

---

### GET /api/medical/patients/:patientId/history
Doctor fetches patient history.

Requires: `verifyDoctorToken`

Response:
```json
{
  "appointments": [...],
  "prescriptions": [...],
  "certificates": [...],
  "doctorEnrollment": { ... }
}
```

---

### POST /api/medical/prescriptions
Create prescription.

Requires: `verifyDoctorToken`

Request body:
```json
{
  "appointmentId": "...",
  "patientId": "...",
  "diagnosis": "Migraine",
  "medicines": ["Ibuprofen"],
  "instructions": "Take after food",
  "followUpDate": "2026-06-20"
}
```

Response:
- created prescription

---

### POST /api/medical/certificates
Create medical certificate.

Requires: `verifyDoctorToken`

Request body:
```json
{
  "appointmentId": "...",
  "patientId": "...",
  "diagnosis": "Viral fever",
  "recommendation": "Rest",
  "restFromDate": "2026-06-06",
  "restToDate": "2026-06-09",
  "notes": "Avoid strenuous activity"
}
```

Response:
- created certificate

---

### GET /api/medical/my-prescriptions
Patient prescriptions.

Requires: `verifyUserToken`

---

### GET /api/medical/my-certificates
Patient medical certificates.

Requires: `verifyUserToken`

---

## 7. Payments

### POST /api/payments/create-intent
Create Stripe payment intent.

Requires: `verifyUserToken`

Request body:
```json
{ "doctorId": 12345 }
```

Response:
```json
{ "clientSecret": "...", "amount": 50000 }
```

---

### GET /api/payments/fee
Get doctor consultation fee.

Requires: `verifyUserToken`

Query params:
- `doctorId`

Response:
```json
{ "feePaise": 50000, "feeAmount": 500, "feeCurrency": "USD" }
```

---

### GET /api/payments/admin/intent/:id
Admin view Stripe payment intent.

Requires: `verifyAdminToken`, `adminOnly`

---

### POST /api/payments/admin/payment-links
Create payment link.

Requires: `verifyAdminToken`, `paymentAdminOnly`

Request body:
```json
{ "amount": 100, "currency": "USD", "note": "Consultation payment" }
```

---

### GET /api/payments/admin/payment-links
List payment links.

Requires: `verifyAdminToken`, `paymentAdminOnly`

Query filters:
- `createdBy`, `status`, `currency`, `startDate`, `endDate`, `amountMin`, `amountMax`, `q`

---

### GET /api/payments/admin/payment-link-creators
Payment admin creators summary.

Requires: `verifyAdminToken`, `paymentAdminOnly`, `superAdminOnly`

---

### GET /api/payments/payment-links/:token
Public payment link detail.

---

### POST /api/payments/payment-links/:token/create-intent
Create Stripe intent for payment link.

Response:
```json
{ "clientSecret": "...", "amount": 10000, "currency": "usd" }
```

---

### POST /api/payments/payment-links/:token/confirm
Confirm payment link after Stripe payment.

Request body:
```json
{ "paymentIntentId": "pi_..." }
```

Response:
```json
{
  "status": "paid",
  "amountPaise": 10000,
  "currency": "usd",
  "paidAt": "..."
}
```

---

## 8. PayPal

### POST /api/paypal/create-order
Create PayPal order for doctor consultation.

Requires: `verifyUserToken`

Request body:
```json
{ "doctorId": 12345 }
```

Response:
```json
{ "orderId": "..." }
```

---

### POST /api/paypal/capture-order
Capture PayPal order.

Requires: `verifyUserToken`

Request body:
```json
{ "orderId": "..." }
```

Response:
```json
{ "orderId": "...", "status": "COMPLETED", "amountPaise": 12345 }
```

---

## 9. Support Tickets

### POST /api/tickets/create
Create ticket (doctor only).

Requires: `verifyDoctorToken`

Request body:
```json
{ "title": "Issue with appointment", "description": "..." }
```

---

### GET /api/tickets/my
Doctor ticket list.

Requires: `verifyDoctorToken`

---

### POST /api/tickets/user/create
Create ticket (user/patient).

Requires: `verifyUserToken`

Request body:
```json
{ "title": "Billing issue", "description": "...", "category": "billing" }
```

---

### GET /api/tickets/user/my
User ticket list.

Requires: `verifyUserToken`

---

### GET /api/tickets/all
List all doctor tickets.

Requires: `verifyAdminToken`, `adminOnly`

---

### PUT /api/tickets/:id/resolve
Resolve doctor ticket.

Requires: `verifyAdminToken`, `adminOnly`

Request body:
```json
{ "resolution": "Issue resolved." }
```

---

### GET /api/tickets/user/all
List all user tickets.

Requires: `verifyAdminToken`, `adminOnly`

---

### PUT /api/tickets/user/:id/resolve
Resolve user ticket.

Requires: `verifyAdminToken`, `adminOnly`

---

## 10. Admin

### GET /api/admin/stats
Requires: `verifyAdminToken`, `adminOnly`

Response:
```json
{ "totalUsers": 100, "activeUsers": 100, "totalDoctors": 25, "totalAppointments": 40 }
```

---

### GET /api/admin/doctors
Requires: `verifyAdminToken`, `adminOnly`

Response:
- list of all doctor enrollments

---

### GET /api/admin/approved-doctors
Requires: `verifyAdminToken`, `adminOnly`

Response:
- list of approved doctors

---

### GET /api/admin/doctors/:id
Requires: `verifyAdminToken`, `adminOnly`

Response:
- doctor enrollment by `_id`

---

### PUT /api/admin/doctors/:id
Requires: `verifyAdminToken`, `adminOnly`

Request body:
- supports many enrollment fields such as `firstName`, `surname`, `email`, `specialization`, `qualification`, `experience`, `consultantFees`, `clinicName`, `clinicAddress`, `availability`, `paypalId`, `payoutEmail`, `stripeAccountId`, `applicationStatus`, etc.

Response:
- updated enrollment object

---

### PUT /api/admin/doctors/:id/approve
Approve a doctor enrollment.

Requires: `verifyAdminToken`, `adminOnly`

---

### PUT /api/admin/doctors/:id/reject
Reject a doctor enrollment.

Requires: `verifyAdminToken`, `adminOnly`

---

### PUT /api/admin/doctors/:id/delete/approve
Approve doctor profile delete request.

Requires: `verifyAdminToken`, `adminOnly`

---

### PUT /api/admin/doctors/:id/delete/reject
Reject doctor profile delete request.

Requires: `verifyAdminToken`, `adminOnly`

---

### POST /api/admin/migrate/doctor-ids
One-time doctor ID migration.

Requires: `verifyAdminToken`, `adminOnly`

---

### GET /api/admin/users
Requires: `verifyAdminToken`, `adminOnly`

---

### GET /api/admin/users/:id
Requires: `verifyAdminToken`, `adminOnly`

---

### POST /api/admin/users/:id/force-logout
Requires: `verifyAdminToken`, `superAdminOnly`

Response:
```json
{ "msg": "Active sessions revoked.", "revokedCount": 1 }
```

---

### PUT /api/admin/users/:id/disable
Requires: `verifyAdminToken`, `superAdminOnly`

Request body:
```json
{ "reason": "Administrative security action" }
```

---

### DELETE /api/admin/users/:id
Requires: `verifyAdminToken`, `adminOnly`

---

### GET /api/admin/doctor-payments
Requires: `verifyAdminToken`, `adminOnly`

Response:
- payment records and payout details

---

### PUT /api/admin/doctor-payments/:id/mark-paid
Requires: `verifyAdminToken`, `superAdminOnly`

Request body:
```json
{ "payoutRef": "Payout123" }
```

---

### PUT /api/admin/doctor-payments/:id
Requires: `verifyAdminToken`, `superAdminOnly`

Request body:
```json
{
  "doctorPayoutStatus": "paid",
  "doctorPayoutDate": "2026-06-05T00:00:00.000Z",
  "doctorPayoutRef": "REF123",
  "doctorPayoutOverrideAmount": 4200
}
```

---

### POST /api/admin/doctor-payments/:id/process-payout
Requires: `verifyAdminToken`, `superAdminOnly`

Request body:
```json
{ "method": "paypal" }
```
or
```json
{ "method": "stripe" }
```

---

## 11. Superadmin

### GET /api/superadmin/admins
Requires: `verifyAdminToken`, `superAdminOnly`

---

### POST /api/superadmin/admins
Create admin or paymentadmin.

Request body:
```json
{ "name": "New Admin", "email": "admin2@example.com", "password": "AdminPass123!", "role": "admin" }
```

---

### DELETE /api/superadmin/admins/:id
Requires: `verifyAdminToken`, `superAdminOnly`

---

## 12. Audit Logs

### GET /api/audit-logs
Requires: `verifyAdminToken`, `superAdminOnly`

Query params:
- `page`, `limit`, `action`, `userRole`, `success`, `search`, `startDate`, `endDate`, `patientId`

Response:
```json
{ "logs": [...], "total": 100, "page": 1, "totalPages": 2 }
```

---

### GET /api/audit-logs/stats
Requires: `verifyAdminToken`, `superAdminOnly`

Response:
- aggregated audit metrics

---

## 13. Retention Policies

### GET /api/retention-policies
Requires: `verifyAdminToken`, `superAdminOnly`

Response:
- retention policy list

---

### PUT /api/retention-policies
Requires: `verifyAdminToken`, `superAdminOnly`

Request body:
```json
{
  "policies": [
    { "key": "auditLogs", "retentionDays": 1800, "enabled": true },
    { "key": "medicalRecords", "retentionDays": 2555, "enabled": true }
  ]
}
```

---

### POST /api/retention-policies/cleanup
Requires: `verifyAdminToken`, `superAdminOnly`

Response:
- cleanup result object

---

## 14. Health Check

### GET /api/health
Public.

Response:
```
API Running...
```

---

## Integration Notes for Mobile Apps

- Use Bearer tokens or cookie-based authentication depending on mobile platform requirements.
- For login/register flows, store refresh tokens securely and call `/api/auth/refresh` when access tokens expire.
- Use `/api/appointments/booked-slots` before booking to show available times.
- File uploads must use `multipart/form-data` with field name `file`.
- For payments, mobile should create a Stripe intent or PayPal order before calling appointment booking.
- Doctor identity lookups should use numeric `doctorId` via `/api/doctor/profile/:doctorId`.
- Include error handling for status codes `400`, `401`, `403`, `404`, `409`, and `500`.

## Recommended Headers

- `Content-Type: application/json` for JSON requests
- `Authorization: Bearer <token>` for protected requests
- `Accept: application/json`

---

This document is intended for mobile developers building apps on top of the HumanCare Connect backend.
