// Files in the chat window: a patient opens their OWN files (thumbnail, open, download), the file id stays on reload,
// an unreadable name falls back to "attachment", and only open/download are logged (a thumbnail is not).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { startChatServer, FILES, AGENT_A } = require("./helpers/liveChatServer");
const c = require("../utils/liveChat/crypto");

describe("live chat: file bubbles (thumbnail, open, download) for patient and team", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100", LIVECHAT_UPLOADS_PER_10_MIN: "50", LIVECHAT_MAX_FILES_PER_CHAT: "10" },
    });
  });
  after(async () => {
    await lc.close();
  });

  async function openChat() {
    const contact = await lc.submitContact();
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    return { socket, token: contact.token, id: started.conversation.conversationId, visitorId: contact.visitorId };
  }
  const stateOf = async (socket) => (await lc.call(socket, "chat:resume")).conversation;
  const patientLink = (token, fileId, purpose) =>
    fetch(`${lc.url}/api/livechat/files/${fileId}/url${purpose ? `?purpose=${purpose}` : ""}`, { headers: { authorization: `Bearer ${token}` } }).then(async (res) => ({
      status: res.status,
      body: await res.json().catch(() => ({})),
    }));
  const adminLink = (fileId, purpose) => lc.rest("GET", `/files/${fileId}/url${purpose ? `?purpose=${purpose}` : ""}`, { user: AGENT_A });

  async function chatWithOwnFile(name = "Scan.png", buffer = FILES.png) {
    const chat = await openChat();
    const live = new Promise((resolve) => chat.socket.once("chat:message", resolve));
    const up = await lc.upload(chat.token, { name, buffer });
    assert.equal(up.status, 200, JSON.stringify(up.body));
    const pushed = await live;
    const fileId = pushed.message.file.id;
    return { chat, fileId };
  }

  test("the patient's own file keeps its id: live over the socket and after a reload", async () => {
    const { chat, fileId } = await chatWithOwnFile();
    assert.ok(fileId, "the live message carries the id");
    const reloaded = (await stateOf(chat.socket)).messages.find((m) => m.file);
    assert.equal(reloaded.sender, "patient");
    assert.equal(reloaded.file.id, fileId, "the id is still there after a reload");
    assert.equal(reloaded.file.mime, "image/png");
    chat.socket.close();
  });

  test("a patient opens their own file; another visitor cannot", async () => {
    const { chat, fileId } = await chatWithOwnFile();
    const other = await openChat();
    const ok = await patientLink(chat.token, fileId);
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.match(ok.body.url, /^https:\/\/files\.test\/livechat\//);
    assert.equal(ok.body.name, "Scan.png");
    assert.equal(ok.body.mime, "image/png");
    assert.equal((await patientLink(other.token, fileId)).status, 404);
    assert.equal((await patientLink("not-a-token", fileId)).status, 401);
    chat.socket.close();
    other.socket.close();
  });

  test("patient links: a thumbnail is not logged; open and download are; download is saved, not shown", async () => {
    const { chat, fileId } = await chatWithOwnFile();
    const log = async () => (await lc.models.LcFile.findById(fileId).lean()).patientAccessLog.length;
    await patientLink(chat.token, fileId, "preview");
    await patientLink(chat.token, fileId, "preview");
    assert.equal(await log(), 0, "thumbnails leave no access log");
    assert.equal(lc.presigned.at(-1).disposition, "inline");
    await patientLink(chat.token, fileId, "open");
    assert.equal(await log(), 1);
    assert.equal(lc.presigned.at(-1).disposition, "inline");
    await patientLink(chat.token, fileId, "download");
    assert.equal(await log(), 2);
    assert.equal(lc.presigned.at(-1).disposition, "attachment");
    await patientLink(chat.token, fileId); // no purpose = open
    assert.equal(await log(), 3);
    await patientLink(chat.token, fileId, "something-else"); // unknown purposes count as open, never as a free preview
    assert.equal(await log(), 4);
    chat.socket.close();
  });

  test("the team: preview is not logged, open and download are, and the names stay the same", async () => {
    const { chat, fileId } = await chatWithOwnFile("Blood test.pdf", FILES.pdf);
    const log = async () => (await lc.models.LcFile.findById(fileId).lean()).accessLog.length;
    assert.equal((await adminLink(fileId, "preview")).status, 200);
    assert.equal(await log(), 0);
    assert.equal(lc.presigned.at(-1).disposition, "inline");
    const opened = await adminLink(fileId);
    assert.equal(opened.body.name, "Blood test.pdf");
    assert.equal(await log(), 1);
    await adminLink(fileId, "download");
    assert.equal(await log(), 2);
    assert.equal(lc.presigned.at(-1).disposition, "attachment");
    chat.socket.close();
  });

  test("a file of a chat in Trash cannot be previewed by the patient", async () => {
    const { chat, fileId } = await chatWithOwnFile();
    await lc.models.LcConversation.updateOne({ conversationId: chat.id }, { $set: { mode: "trashed" } });
    assert.equal((await patientLink(chat.token, fileId, "preview")).status, 404);
    chat.socket.close();
  });

  test("a file name that no key can decrypt shows as 'attachment' for the patient and the team, never the placeholder", async () => {
    const chat = await openChat();
    const keyB = crypto.randomBytes(32).toString("hex");
    const saved = process.env.LIVECHAT_ENCRYPTION_KEY;
    let foreign;
    process.env.LIVECHAT_ENCRYPTION_KEY = keyB;
    try {
      foreign = c.encryptLiveChatText("name written under another key");
    } finally {
      if (saved === undefined) delete process.env.LIVECHAT_ENCRYPTION_KEY;
      else process.env.LIVECHAT_ENCRYPTION_KEY = saved;
    }
    const doc = await lc.models.LcFile.create({
      conversationId: chat.id,
      visitorId: chat.visitorId,
      s3Key: `livechat/${chat.id}/00000000-0000-4000-8000-000000000000.pdf`,
      name: foreign,
      mimeType: "application/pdf",
      size: 10,
    });
    await lc.models.LcMessage.create({ conversationId: chat.id, sender: "patient", text: foreign, fileId: doc._id });
    const patientSees = (await stateOf(chat.socket)).messages.find((m) => m.file);
    assert.equal(patientSees.file.name, "attachment");
    assert.equal(patientSees.file.id, String(doc._id));
    const detail = (await lc.rest("GET", `/conversations/${chat.id}`, { user: AGENT_A })).body;
    assert.equal(detail.messages.find((m) => m.file).file.name, "attachment");
    assert.equal(JSON.stringify(detail.messages.find((m) => m.file).file).includes("mismatch"), false);
    chat.socket.close();
  });

  test("storage trouble: the patient gets a clear code, the log gets ONE line with the reason and no file name, key or bucket", async () => {
    const { chat, fileId } = await chatWithOwnFile("Day03_Cover.png");
    const lines = [];
    const original = console.warn;
    console.warn = (...args) => lines.push(args.join(" "));
    try {
      lc.failures.presign = true; // S3 refuses
      const refused = await patientLink(chat.token, fileId, "preview");
      assert.equal(refused.status, 502);
      assert.equal(refused.body.error, "storage_failed");
      const nameless = Object.assign(new Error("AWS S3 bucket is not configured."), { name: "Error" });
      lc.failures.presign = nameless; // no bucket / no credentials
      const missing = await patientLink(chat.token, fileId, "download");
      assert.equal(missing.status, 503);
      assert.equal(missing.body.error, "storage_not_configured");
    } finally {
      lc.failures.presign = false;
      console.warn = original;
    }
    const ours = lines.filter((l) => l.startsWith("[livechat] file link failed"));
    assert.equal(ours.length, 2, "one line per failure");
    assert.match(ours[0], /storage Error$/);
    assert.match(ours[1], /storage not_configured$/);
    for (const line of ours) assert.doesNotMatch(line, /Day03|secret-bucket|livechat\/|png/i);
    chat.socket.close();
  });

  test("thumbnail links have their own, larger rate limit (it does not share the /config budget)", () => {
    const limiters = require("../middleware/rateLimiters");
    assert.equal(typeof limiters.liveChatFileUrlLimiter, "function");
    const route = fs.readFileSync(path.join(__dirname, "..", "routes", "liveChatPublic.js"), "utf8");
    assert.match(route, /router\.get\("\/files\/:id\/url", fileUrlLimiter,/);
    const source = fs.readFileSync(path.join(__dirname, "..", "middleware", "rateLimiters.js"), "utf8");
    const block = source.slice(source.indexOf("const liveChatFileUrlLimiter"), source.indexOf("});", source.indexOf("const liveChatFileUrlLimiter")));
    assert.match(block, /max:\s+120/);
  });
});
