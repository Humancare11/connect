# Breach Response Plan

## Purpose
This workflow defines how Humancare Connect identifies, investigates, contains, documents, and closes suspected security incidents involving PHI, authentication systems, or privileged access.

## Incident Sources
- Multiple failed login attempts and rate-limit events.
- Unauthorized access to authenticated APIs.
- Privilege escalation attempts against admin, super admin, or doctor-only endpoints.
- Large administrative data access that may indicate export or scraping.
- PHI access outside normal operating hours.
- Manual reports from users, doctors, administrators, or infrastructure providers.

## Response Workflow
1. Detect and log the incident in `SecurityIncident`.
2. Alert the security team using `SECURITY_ALERT_EMAILS` when configured.
3. Triage severity as low, medium, high, or critical.
4. Contain the issue by revoking sessions, forcing logout, disabling accounts, or blocking affected workflows.
5. Investigate by recording actions, notes, status changes, affected users, IPs, user agents, and resources in the incident history.
6. Preserve audit logs and related evidence.
7. Determine whether PHI was accessed, acquired, used, or disclosed without authorization.
8. Notify required parties according to applicable HIPAA breach notification obligations and internal counsel guidance.
9. Remediate root causes and validate controls.
10. Close the incident as resolved or false positive with a final investigation note.

## Containment Actions
- Revoke a single session or all sessions for an account.
- Disable accounts involved in suspicious activity.
- Rotate application, chat encryption, and integration keys.
- Restrict administrative access until investigation is complete.
- Pause data exports or high-volume access paths.

## Evidence Requirements
- Incident ID and timestamps.
- Affected user, patient, doctor, admin, and resource identifiers.
- IP address and user agent.
- Audit log references.
- Actions taken and by whom.
- Notification and remediation decisions.

## Audit Requirements
All breach-related viewing and investigation updates must be logged in `AuditLog` and retained according to the active retention policy.
