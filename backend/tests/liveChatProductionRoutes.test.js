// The public live-chat routes in production mode (NODE_ENV=production, LIVECHAT_ENABLED=true).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startChatServer } = require("./helpers/liveChatServer");

const KEY = "a".repeat(64); // 32 bytes as hex

describe("live chat: public routes in production mode", () => {
  let lc;
  before(async () => {
    lc = await startChatServer({ env: { NODE_ENV: "production", LIVECHAT_ENCRYPTION_KEY: KEY } });
  });
  after(async () => {
    await lc.close();
  });

  test("GET /api/livechat/config answers 200 with enabled:true", async () => {
    const res = await fetch(`${lc.url}/api/livechat/config`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).enabled, true);
  });

  test("the admin API is mounted next to it", async () => {
    const res = await fetch(`${lc.url}/api/admin/livechat/settings`);
    assert.notEqual(res.status, 404);
  });

  test("a double slash ('//api/livechat/config', what a base URL with a trailing slash produces) is a 404, so the client must not build it", async () => {
    const res = await fetch(`${lc.url}//api/livechat/config`);
    assert.equal(res.status, 404);
  });
});
