const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startLiveChatServer, once, sleep } = require("./helpers/liveChatServer");
const routes = require("../routes/adminLiveChat");
const { verifyAdminToken, liveChatAgentOnly } = require("../middleware/verifyToken");

describe("live chat: admin-only access", () => {
  let lc;
  before(async () => {
    lc = await startLiveChatServer();
  });
  after(async () => {
    await lc.close();
  });

  describe("REST /api/admin/livechat", () => {
    const get = async (path, role) => {
      const res = await fetch(`${lc.url}/api/admin/livechat${path}`, {
        headers: role ? { "x-test-role": role } : {},
      });
      return res.status;
    };

    test("the real guard chain is a verified admin session followed by the agent-role check", () => {
      assert.deepEqual(routes.DEFAULT_GUARD, [verifyAdminToken, liveChatAgentOnly]);
    });

    test("admin and superadmin can read", async () => {
      for (const role of ["admin", "superadmin"]) {
        assert.equal(await get("/visitors", role), 200, role);
        assert.equal(await get("/summary", role), 200, role);
        assert.equal(await get("/settings", role), 200, role);
      }
    });

    test("everyone else is refused", async () => {
      for (const role of ["employeeadmin", "paymentadmin", "doctor", "user", "partner"]) {
        for (const path of ["/visitors", "/summary", "/settings"]) {
          assert.equal(await get(path, role), 403, `${role} ${path}`);
        }
      }
    });

    test("no session is refused", async () => {
      assert.equal(await get("/visitors"), 401);
    });
  });

  describe("socket /livechat-admin", () => {
    test("admin and superadmin connect and get the visitor snapshot", async () => {
      for (const token of ["admin-token", "super-token"]) {
        const socket = await lc.agent(token);
        const snapshot = await socket.snapshotPromise;
        assert.ok(Array.isArray(snapshot.visitors));
        socket.close();
      }
    });

    test("the admin cookie works as well as a handshake token", async () => {
      const socket = await lc.connect("/livechat-admin", { headers: { cookie: "adminToken=admin-token" } });
      assert.ok(socket.connected);
      socket.close();
    });

    test("employeeadmin, paymentadmin, doctor, user and partner tokens are refused at connect", async () => {
      for (const token of ["employee-token", "payment-token", "doctor-token", "user-token", "partner-token"]) {
        await assert.rejects(lc.agent(token), { message: "forbidden" }, token);
      }
    });

    test("a non-admin cookie cannot make an agent", async () => {
      await assert.rejects(
        lc.connect("/livechat-admin", { headers: { cookie: "adminToken=user-token; doctorToken=admin-token" } }),
        { message: "forbidden" }
      );
    });

    test("no token and a visitor handshake are refused", async () => {
      await assert.rejects(lc.connect("/livechat-admin"), { message: "forbidden" });
      await assert.rejects(
        lc.connect("/livechat-admin", { auth: { visitorId: "visitor-0123456789abcdef", consent: true } }),
        { message: "forbidden" }
      );
    });

    test("the role is checked on every event: a demoted agent is disconnected on their next event", async () => {
      lc.identities["temp-token"] = { id: "t9", role: "admin" };
      const socket = await lc.agent("temp-token");
      await socket.snapshotPromise;
      lc.identities["temp-token"] = { id: "t9", role: "user" }; // demoted after connecting
      const closed = once(socket, "disconnect");
      socket.emit("visitors:get");
      assert.equal((await closed)[0], "io server disconnect");
    });

    test("a revoked session is disconnected on the next event", async () => {
      lc.identities["gone-token"] = { id: "g1", role: "admin" };
      const socket = await lc.agent("gone-token");
      await socket.snapshotPromise;
      delete lc.identities["gone-token"];
      const closed = once(socket, "disconnect");
      socket.emit("visitors:get");
      assert.equal((await closed)[0], "io server disconnect");
    });

    test("unknown events and oversized payloads are dropped without reaching a handler", async () => {
      const socket = await lc.agent("admin-token");
      await socket.snapshotPromise;
      let acked = false;
      socket.emit("visitors:get", { pad: "x".repeat(10_000) }, () => {
        acked = true;
      });
      socket.emit("delete:everything", { all: true });
      await sleep(150);
      assert.equal(acked, false);
      assert.ok(socket.connected);
      socket.close();
    });
  });

  describe("socket /livechat (visitors) cannot reach agent data", () => {
    test("a visitor socket ignores agent events and never receives visitor lists", async () => {
      const visitor = await lc.visitor();
      let received = false;
      visitor.onAny(() => {
        received = true;
      });
      visitor.emit("visitors:get", () => {
        received = true;
      });
      visitor.emit("chat:typing", { conversationId: "x", typing: true });
      await sleep(150);
      assert.equal(received, false);
      visitor.close();
    });

    test("a visitor handshake needs a valid id and cookie consent", async () => {
      await assert.rejects(lc.connect("/livechat", { auth: { visitorId: "short", consent: true } }), {
        message: "invalid_visitor",
      });
      await assert.rejects(lc.connect("/livechat", { auth: { visitorId: "visitor-0123456789abcdef" } }), {
        message: "consent_required",
      });
    });
  });
});
