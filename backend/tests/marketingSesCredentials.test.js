// SES must use the EC2 instance role only, never AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from the environment
// (those may be the S3 keys). A local fake instance-metadata server stands in for the role; no real AWS is touched.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { sesClientConfig } = require("../services/marketing/sesSender");

const KEYS = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN", "AWS_PROFILE", "AWS_EC2_METADATA_SERVICE_ENDPOINT", "AWS_EC2_METADATA_DISABLED"];

test("SES client credentials come from instance metadata, ignoring env access keys", async (t) => {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  const server = http.createServer((req, res) => {
    if (req.method === "PUT") { res.setHeader("x-aws-ec2-metadata-token-ttl-seconds", "21600"); return res.end("token"); }
    if (req.url.endsWith("/security-credentials/") || req.url.endsWith("/security-credentials")) return res.end("marketing-role");
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      Code: "Success", Type: "AWS-HMAC", AccessKeyId: "ROLEKEYID", SecretAccessKey: "role-secret", Token: "role-token",
      Expiration: new Date(Date.now() + 3600e3).toISOString(),
    }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => {
    server.close();
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });
  process.env.AWS_ACCESS_KEY_ID = "S3KEYID";
  process.env.AWS_SECRET_ACCESS_KEY = "s3-secret";
  process.env.AWS_SESSION_TOKEN = "s3-token";
  delete process.env.AWS_PROFILE;
  delete process.env.AWS_EC2_METADATA_DISABLED;
  process.env.AWS_EC2_METADATA_SERVICE_ENDPOINT = `http://127.0.0.1:${server.address().port}`;

  const { SESv2Client } = require("@aws-sdk/client-sesv2");
  const client = new SESv2Client(sesClientConfig({ region: "ap-south-1" }));
  const creds = await client.config.credentials();
  assert.equal(creds.accessKeyId, "ROLEKEYID");
  assert.notEqual(creds.accessKeyId, "S3KEYID");
  assert.equal(creds.sessionToken, "role-token");
});

test("sesClientConfig always passes an explicit credentials provider", () => {
  const c = sesClientConfig({ region: "ap-south-1" });
  assert.equal(c.region, "ap-south-1");
  assert.equal(typeof c.credentials, "function");
});
