const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { startChatServer, FILES, AGENT_A } = require("./helpers/liveChatServer");

const MB = 1024 * 1024;

describe("live chat: patient file uploads and admin access", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({
      env: { LIVECHAT_IP_DAILY_CHAT_LIMIT: "1000", LIVECHAT_MESSAGES_PER_MINUTE: "100", LIVECHAT_UPLOADS_PER_10_MIN: "5", LIVECHAT_MAX_FILES_PER_CHAT: "10" },
    });
    // the per-IP upload limiter of the route is not what is under test here
  });
  after(async () => {
    await lc.close();
  });

  const rest = (...args) => lc.rest(...args);

  async function openChat() {
    const contact = await lc.submitContact();
    const socket = await lc.chatSocket(contact.token);
    const started = await lc.call(socket, "chat:start", {});
    return { socket, token: contact.token, id: started.conversation.conversationId, visitorId: contact.visitorId };
  }
  const stateOf = async (socket) => (await lc.call(socket, "chat:resume")).conversation;

  describe("what is accepted", () => {
    test("pdf, jpg and png are stored in S3 under a random key; the patient and the team see the file message", async () => {
      const chat = await openChat();
      for (const [kind, file] of [["pdf", FILES.pdf], ["jpg", FILES.jpg], ["png", FILES.png]]) {
        const name = `Lab results ${kind}.${kind}`;
        const res = await lc.upload(chat.token, { name, buffer: file, type: "application/octet-stream" });
        assert.equal(res.status, 200, `${kind}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.file.name, name);
      }
      const keys = [...lc.store.keys()].filter((k) => k.startsWith(`livechat/${chat.id}/`));
      assert.equal(keys.length, 3);
      assert.ok(keys.every((k) => /^livechat\/HC[A-Z0-9]{8}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(k)), "random key, no file name in it");
      assert.deepEqual(keys.map((k) => lc.store.get(k).contentType).sort(), ["application/pdf", "image/jpeg", "image/png"]);

      const patient = await stateOf(chat.socket);
      const fileMessages = patient.messages.filter((m) => m.file);
      assert.equal(fileMessages.length, 3);
      assert.deepEqual(fileMessages.map((m) => m.sender), ["patient", "patient", "patient"]);
      assert.equal(fileMessages[0].file.mime, "application/pdf");

      const detail = (await rest("GET", `/conversations/${chat.id}`)).body;
      const adminFile = detail.messages.find((m) => m.file);
      assert.ok(adminFile.file.id, "admins get a file id to open it");
      assert.equal(detail.messages.filter((m) => m.file).length, 3);
      chat.socket.close();
    });

    test("exactly 10 MB is accepted", async () => {
      const chat = await openChat();
      const big = Buffer.concat([FILES.pdf, Buffer.alloc(10 * MB - FILES.pdf.length, 0x20)]);
      assert.equal(big.length, 10 * MB);
      const res = await lc.upload(chat.token, { name: "scan.pdf", buffer: big });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      chat.socket.close();
    });
  });

  describe("what is refused", () => {
    test("over 10 MB: 413 and nothing is stored", async () => {
      const chat = await openChat();
      const before = lc.store.size;
      const big = Buffer.concat([FILES.pdf, Buffer.alloc(10 * MB - FILES.pdf.length + 1, 0x20)]);
      const res = await lc.upload(chat.token, { name: "huge.pdf", buffer: big });
      assert.deepEqual([res.status, res.body.error], [413, "file_too_large"]);
      assert.equal(lc.store.size, before);
      assert.equal(await lc.models.LcFile.countDocuments({ conversationId: chat.id }), 0);
      chat.socket.close();
    });

    test("the real type is checked, not the extension: a program renamed .pdf is refused", async () => {
      const chat = await openChat();
      const before = lc.store.size;
      for (const [name, buffer] of [["report.pdf", FILES.exe], ["report.jpg", FILES.html], ["notes.pdf", Buffer.from("just text, not a pdf")]]) {
        const res = await lc.upload(chat.token, { name, buffer, type: "application/pdf" }); // even with a lying content-type
        assert.deepEqual([res.status, res.body.error], [400, "unsupported_type"], name);
      }
      assert.equal(lc.store.size, before);
      chat.socket.close();
    });

    test("a real file with the wrong extension is refused (png named .pdf)", async () => {
      const chat = await openChat();
      const res = await lc.upload(chat.token, { name: "scan.pdf", buffer: FILES.png });
      assert.deepEqual([res.status, res.body.error], [400, "extension_mismatch"]);
      const noExt = await lc.upload(chat.token, { name: "scan", buffer: FILES.pdf });
      assert.equal(noExt.body.error, "extension_mismatch");
      chat.socket.close();
    });

    test("other types the patient might try: gif, zip, svg, docx", async () => {
      const chat = await openChat();
      const cases = [
        ["a.gif", Buffer.from("R0lGODlhAQABAAAAACw=", "base64")],
        ["a.zip", Buffer.from("PK\u0003\u0004rest of an archive")],
        ["a.svg", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")],
      ];
      for (const [name, buffer] of cases) {
        const res = await lc.upload(chat.token, { name, buffer });
        assert.equal(res.status, 400, name);
      }
      chat.socket.close();
    });

    test("an empty file and a request without a file", async () => {
      const chat = await openChat();
      assert.equal((await lc.upload(chat.token, { name: "empty.pdf", buffer: Buffer.alloc(0) })).status, 400);
      const res = await fetch(`${lc.url}/api/livechat/upload`, { method: "POST", headers: { authorization: `Bearer ${chat.token}` }, body: new FormData() });
      assert.equal(res.status, 400);
      chat.socket.close();
    });

    test("no chat token, or a forged one: 401, and the body is never read", async () => {
      assert.equal((await lc.upload("", { name: "a.pdf", buffer: FILES.pdf })).status, 401);
      assert.equal((await lc.upload("forged.token.value", { name: "a.pdf", buffer: FILES.pdf })).status, 401);
    });

    test("a patient with no open chat cannot upload", async () => {
      const contact = await lc.submitContact();
      const res = await lc.upload(contact.token, { name: "a.pdf", buffer: FILES.pdf });
      assert.deepEqual([res.status, res.body.error], [409, "no_conversation"]);

      const chat = await openChat();
      await rest("POST", `/conversations/${chat.id}/resolve`);
      const closed = await lc.upload(chat.token, { name: "a.pdf", buffer: FILES.pdf });
      assert.deepEqual([closed.status, closed.body.error], [409, "no_conversation"]);
      chat.socket.close();
    });

    test("at most 10 files per chat, and 5 uploads per 10 minutes per visitor", async () => {
      const full = await openChat();
      await lc.models.LcFile.insertMany(
        Array.from({ length: 10 }, (_, i) => ({
          conversationId: full.id, visitorId: full.visitorId, s3Key: `livechat/${full.id}/x${i}.pdf`, mimeType: "application/pdf", size: 10,
        }))
      );
      const tooMany = await lc.upload(full.token, { name: "one-more.pdf", buffer: FILES.pdf });
      assert.deepEqual([tooMany.status, tooMany.body.error], [409, "too_many_files"]);

      const busy = await openChat();
      const statuses = [];
      for (let i = 0; i < 6; i += 1) statuses.push((await lc.upload(busy.token, { name: `r${i}.pdf`, buffer: FILES.pdf })).status);
      assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
      full.socket.close();
      busy.socket.close();
    });
  });

  describe("privacy", () => {
    test("the file name is stored encrypted and never reaches S3 metadata, the patient state or the AI", async () => {
      const chat = await openChat();
      const secretName = "HIV-test-results-Emma-Wilson.pdf";
      await lc.upload(chat.token, { name: secretName, buffer: FILES.pdf });

      const raw = await mongoose.connection.db.collection("lcfiles").findOne({ conversationId: chat.id });
      assert.equal(JSON.stringify(raw).includes("HIV"), false, "file name encrypted at rest");
      const rawMessages = await mongoose.connection.db.collection("lcmessages").find({ conversationId: chat.id }).toArray();
      assert.equal(JSON.stringify(rawMessages).includes("HIV"), false);
      const key = [...lc.store.keys()].find((k) => k.includes(chat.id));
      assert.equal(key.includes("HIV"), false);

      const patientState = JSON.stringify(await stateOf(chat.socket));
      assert.equal(patientState.includes("livechat/"), false, "no storage key for the patient");
      assert.equal(patientState.includes("s3Key"), false);

      lc.ai.calls.length = 0;
      await lc.call(chat.socket, "chat:message", { text: "I sent my report" });
      assert.equal(JSON.stringify(lc.ai.calls[0]).includes("HIV"), false, "file names are never given to the AI");
      chat.socket.close();
    });

    test("uploading a file does not start an AI turn", async () => {
      const chat = await openChat();
      lc.ai.calls.length = 0;
      await lc.upload(chat.token, { name: "report.pdf", buffer: FILES.pdf });
      assert.equal(lc.ai.calls.length, 0);
      chat.socket.close();
    });

    test("a patient can only upload into their own chat (the chat comes from the token, not the request)", async () => {
      const a = await openChat();
      const b = await openChat();
      const form = new FormData();
      form.append("file", new Blob([FILES.pdf]), "x.pdf");
      form.append("conversationId", b.id); // ignored
      const res = await fetch(`${lc.url}/api/livechat/upload`, { method: "POST", headers: { authorization: `Bearer ${a.token}` }, body: form });
      assert.equal(res.status, 200);
      assert.equal(await lc.models.LcFile.countDocuments({ conversationId: a.id }), 1);
      assert.equal(await lc.models.LcFile.countDocuments({ conversationId: b.id }), 0);
      a.socket.close();
      b.socket.close();
    });
  });

  describe("admin access (presigned URL after a role check)", () => {
    async function chatWithFile() {
      const chat = await openChat();
      await lc.upload(chat.token, { name: "Blood test.pdf", buffer: FILES.pdf });
      const detail = (await rest("GET", `/conversations/${chat.id}`)).body;
      return { chat, fileId: detail.messages.find((m) => m.file).file.id };
    }

    test("admin and superadmin get a 5-minute link; the access is logged on the file", async () => {
      const { chat, fileId } = await chatWithFile();
      const before = lc.presigned.length;
      const res = await rest("GET", `/files/${fileId}/url`, { user: AGENT_A });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.match(res.body.url, /^https:\/\/files\.test\/livechat\/HC[A-Z0-9]{8}\//);
      assert.equal(res.body.name, "Blood test.pdf");
      assert.equal(res.body.mime, "application/pdf");
      assert.equal(lc.presigned.length, before + 1);
      assert.equal(lc.presigned.at(-1).expiresIn, 300);
      assert.equal(lc.presigned.at(-1).contentType, "application/pdf");
      assert.ok(new Date(res.body.expiresAt) - Date.now() <= 300_000 + 1000);

      const sup = await rest("GET", `/files/${fileId}/url`, { user: "64b000000000000000000c03", role: "superadmin" });
      assert.equal(sup.status, 200);
      const doc = await lc.models.LcFile.findById(fileId).lean();
      assert.deepEqual(doc.accessLog.map((e) => String(e.userId)), [AGENT_A, "64b000000000000000000c03"]);
      chat.socket.close();
    });

    test("everyone else is refused BEFORE any link is made", async () => {
      const { chat, fileId } = await chatWithFile();
      const before = lc.presigned.length;
      for (const role of ["employeeadmin", "paymentadmin", "doctor", "user", "partner"]) {
        assert.equal((await rest("GET", `/files/${fileId}/url`, { role })).status, 403, role);
      }
      const anon = await fetch(`${lc.url}/api/admin/livechat/files/${fileId}/url`);
      assert.equal(anon.status, 401);
      assert.equal(lc.presigned.length, before, "no presigned URL was created for a refused caller");
      assert.equal((await lc.models.LcFile.findById(fileId).lean()).accessLog.length, 0);
      chat.socket.close();
    });

    test("a patient's chat token cannot open a file either", async () => {
      const { chat, fileId } = await chatWithFile();
      const res = await fetch(`${lc.url}/api/admin/livechat/files/${fileId}/url`, { headers: { authorization: `Bearer ${chat.token}` } });
      assert.equal(res.status, 401);
      chat.socket.close();
    });

    test("unknown or malformed ids are a plain 404", async () => {
      assert.equal((await rest("GET", "/files/not-an-id/url")).status, 404);
      assert.equal((await rest("GET", `/files/${new mongoose.Types.ObjectId()}/url`)).status, 404);
    });

    test("if S3 fails the admin gets a clear error, nothing is logged, and no bucket details leak", async () => {
      const { chat, fileId } = await chatWithFile();
      lc.failures.presign = true;
      const res = await rest("GET", `/files/${fileId}/url`);
      lc.failures.presign = false;
      assert.deepEqual([res.status, res.body.error], [502, "storage_failed"]);
      assert.equal(JSON.stringify(res.body).includes("secret-bucket-name"), false);
      assert.equal((await lc.models.LcFile.findById(fileId).lean()).accessLog.length, 0);
      chat.socket.close();
    });

    test("if S3 fails on upload the patient gets a clear error and no half-saved file", async () => {
      const chat = await openChat();
      lc.failures.put = true;
      const res = await lc.upload(chat.token, { name: "report.pdf", buffer: FILES.pdf });
      lc.failures.put = false;
      assert.deepEqual([res.status, res.body.error], [502, "storage_failed"]);
      assert.equal(JSON.stringify(res.body).includes("secret-bucket-name"), false);
      assert.equal(await lc.models.LcFile.countDocuments({ conversationId: chat.id }), 0);
      assert.equal((await stateOf(chat.socket)).messages.some((m) => m.file), false);
      chat.socket.close();
    });
  });
});
