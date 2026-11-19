const { marketingConfig } = require("./config");

// The ONLY place that talks to Amazon SES. Marketing mail never goes through Gmail, and system mail (OTP,
// appointments) never goes through here. Credentials come from the AWS default chain, i.e. the EC2 instance
// role: no access keys are read or stored by this code.

const ASCII = /^[\x20-\x7E]*$/;

// "Display Name" <address>. A non-ASCII name is sent RFC 2047 encoded, as SES requires.
function formatFrom(name, address) {
  const clean = String(name || "").replace(/[\r\n"<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!clean) return address;
  const display = ASCII.test(clean) ? `"${clean}"` : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
  return `${display} <${address}>`;
}

// What to do with a failed send. SES can only be retried safely when we KNOW it did not accept the mail.
//   retry      throttled / rate limited: not accepted, try again soon
//   hold       account or setup problem (paused, suspended, unverified, no permission): pause the campaign, keep the recipient queued
//   fail       SES refused this message: final for this recipient
//   uncertain  anything else (timeouts, 5xx, network): SES may or may not have accepted it, so it is NEVER re-sent automatically
function classifySesError(err) {
  const name = String(err?.name || err?.Code || "");
  const status = Number(err?.$metadata?.httpStatusCode) || 0;
  if (["ThrottlingException", "TooManyRequestsException", "LimitExceededException", "SlowDown"].includes(name) || status === 429) {
    return { kind: "retry", code: name || "throttled" };
  }
  if (
    ["SendingPausedException", "AccountSuspendedException", "MailFromDomainNotVerifiedException", "NotFoundException", "AccessDeniedException", "UnrecognizedClientException", "ExpiredTokenException", "CredentialsProviderError"].includes(name)
  ) {
    return { kind: "hold", code: name };
  }
  if (["MessageRejected", "BadRequestException", "InvalidParameterValue"].includes(name) || (status >= 400 && status < 500)) {
    return { kind: "fail", code: name || "rejected" };
  }
  return { kind: "uncertain", code: name || "unknown" };
}

// Options exist so tests can inject a fake `client` ({ send(command) }) and never touch AWS.
function createSesSender({ cfg = marketingConfig(), client = null } = {}) {
  let ses = client;
  const getClient = () => {
    if (!ses) {
      const { SESv2Client } = require("@aws-sdk/client-sesv2");
      ses = new SESv2Client({ region: cfg.region });
    }
    return ses;
  };

  // → { messageId }. Throws the SDK error unchanged (see classifySesError).
  async function send({ fromAddress, fromName, to, replyTo, subject, html, text, unsubscribeUrl = "", tags = {} }) {
    const { SendEmailCommand } = require("@aws-sdk/client-sesv2");
    const headers = unsubscribeUrl
      ? [
          { Name: "List-Unsubscribe", Value: `<${unsubscribeUrl}>` },
          { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
        ]
      : [];
    const tagList = Object.entries(tags)
      .filter(([, v]) => v)
      .map(([Name, Value]) => ({ Name, Value: String(Value) }));
    const command = new SendEmailCommand({
      FromEmailAddress: formatFrom(fromName, fromAddress),
      Destination: { ToAddresses: [to] }, // exactly one recipient per mail: never several in To/Cc/Bcc
      ReplyToAddresses: [replyTo || fromAddress],
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Html: { Data: html, Charset: "UTF-8" }, Text: { Data: text, Charset: "UTF-8" } },
          ...(headers.length ? { Headers: headers } : {}),
        },
      },
      ...(cfg.configurationSet ? { ConfigurationSetName: cfg.configurationSet } : {}),
      ...(tagList.length ? { EmailTags: tagList } : {}),
    });
    const res = await getClient().send(command);
    return { messageId: String(res?.MessageId || "") };
  }

  return { send };
}

module.exports = { createSesSender, classifySesError, formatFrom };
