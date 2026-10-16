const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createOpenAiProvider } = require("../services/liveChat/aiProviders/openai");
const { createAiService } = require("../services/liveChat/aiService");
const { readAiConfig } = require("../utils/liveChat/config");

const ENV = {
  LIVECHAT_MODEL: "gpt-6-luna",
  LIVECHAT_OPENAI_API_KEY: "test-key",
  LIVECHAT_PRICE_INPUT_PER_1M: "0.10",
  LIVECHAT_PRICE_OUTPUT_PER_1M: "0.50",
};

// A fake OpenAI client that records every request body.
function fakeClient(requests) {
  return {
    chat: {
      completions: {
        async create(request) {
          requests.push(request);
          return { choices: [{ message: { content: "{}" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } };
        },
      },
    },
  };
}

describe("live chat: OpenAI data handling", () => {
  test("every model call is sent with store: false (reply, suggestion, summary, translation, language detection)", async () => {
    const requests = [];
    const config = readAiConfig(ENV);
    const service = createAiService({
      env: ENV,
      providers: { openai: () => createOpenAiProvider(config, { clientFactory: () => fakeClient(requests) }) },
      log: () => {},
    });
    const history = [{ role: "patient", text: "hello there" }];
    await service.generateReply({ settings: {}, history });
    await service.suggestReply({ settings: {}, history, agentName: "Sam" });
    await service.summarizeChat({ history });
    await service.translateBatch({ items: [{ id: "1", text: "Guten Tag" }], target: "English" });
    await service.detectLanguage({ text: "Guten Tag, ich brauche einen Termin" });
    assert.ok(requests.length >= 5, `expected at least 5 requests, got ${requests.length}`);
    for (const request of requests) assert.equal(request.store, false);
  });

  test("the OpenAI SDK is only used by the provider file, so no call can skip store: false", () => {
    const dir = path.join(__dirname, "..", "services", "liveChat");
    const offenders = [];
    const walk = (d) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.js$/.test(entry.name) && /require\(["']openai["']\)/.test(fs.readFileSync(full, "utf8"))) offenders.push(path.relative(dir, full));
      }
    };
    walk(dir);
    assert.deepEqual(offenders.map((f) => f.replace(/\\/g, "/")), ["aiProviders/openai.js"]);
  });

  test("optional organisation and project ids are read from LIVECHAT_OPENAI_ORG_ID / LIVECHAT_OPENAI_PROJECT_ID", () => {
    assert.equal(readAiConfig(ENV).organization, "");
    assert.equal(readAiConfig(ENV).project, "");
    const config = readAiConfig({ ...ENV, LIVECHAT_OPENAI_ORG_ID: " org_abc ", LIVECHAT_OPENAI_PROJECT_ID: "proj_xyz" });
    assert.equal(config.organization, "org_abc");
    assert.equal(config.project, "proj_xyz");
    // they never make the AI unusable
    assert.equal(readAiConfig(ENV).usable, true);
  });

  test("the ids are handed to the SDK client as organization / project", () => {
    const OpenAI = require("openai").OpenAI;
    const client = new OpenAI({ apiKey: "k", organization: "org_abc", project: "proj_xyz" });
    assert.equal(client.organization, "org_abc");
    assert.equal(client.project, "proj_xyz");
    const source = fs.readFileSync(path.join(__dirname, "..", "services", "liveChat", "aiProviders", "openai.js"), "utf8");
    assert.match(source, /organization: config\.organization/);
    assert.match(source, /project: config\.project/);
  });

  test("a production startup warns about missing ids by name only, never printing values", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "services", "liveChat", "index.js"), "utf8");
    assert.match(source, /LIVECHAT_OPENAI_ORG_ID/);
    assert.match(source, /LIVECHAT_OPENAI_PROJECT_ID/);
    assert.doesNotMatch(source, /console\.\w+\([^)]*env\.LIVECHAT_OPENAI_(ORG|PROJECT)_ID/);
  });
});
