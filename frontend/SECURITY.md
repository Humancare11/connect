# Security Register

## B-055 – LiveChat License ID Exposure

Status: Informational
Severity: Low
Finding:
The LiveChat license ID (19785761) is visible in the client-side JavaScript bundle and requests to api.livechatinc.com.

Assessment:
The license ID is required for client-side widget initialization and is not considered a secret credential. It does not provide administrative access or expose sensitive data.

Action:
No remediation required.
Risk accepted and documented.

Reviewed On:
<date>

Reviewed By:
<your name>