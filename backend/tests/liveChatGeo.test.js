const { test, describe, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const geoIp = require("../utils/geoIp");
const { startLiveChatServer, sleep, VISITOR_ID } = require("./helpers/liveChatServer");

// A DB-IP City Lite record, as the .mmdb reader returns it (the real file is not needed: the reader is injected).
const record = (iso, subdivision, city) => ({
  country: { iso_code: iso },
  subdivisions: [{ names: { en: subdivision } }],
  city: { names: { en: city } },
});

describe("live chat: visitor location (GeoIP) reaches the visitor payload", () => {
  let lc;
  afterEach(async () => {
    geoIp._setReader(null);
    await lc?.close();
    lc = null;
  });

  // The latest "upsert" the agents were sent for the test visitor.
  const lastUpsert = (agent) => [...agent.events].reverse().find(([event, payload]) => event === "visitors:delta" && payload.type === "upsert" && payload.visitor.visitorId === VISITOR_ID)?.[1].visitor;

  test("a known public IP gives city, region, country and country code, through the real lookup", async () => {
    geoIp._setReader({ get: (ip) => (ip === "8.8.8.8" ? record("US", "Texas", "Austin") : null) });
    // Outside production LIVECHAT_DEV_FAKE_IP stands in for the visitor's public address (localhost has none).
    lc = await startLiveChatServer({ env: { NODE_ENV: "development", LIVECHAT_DEV_FAKE_IP: "8.8.8.8" }, mount: { lookupLocation: geoIp.lookupLocation } });
    const agent = await lc.agent();
    await agent.snapshotPromise;
    const visitor = await lc.visitor();
    await sleep(200);

    const payload = lastUpsert(agent);
    assert.deepEqual(payload.geo, { city: "Austin", state: "Texas", country: "United States", countryCode: "US" });
    assert.equal(payload.ip, "8.8.8.8");
    visitor.close();
  });

  test("a private IP gives empty location values and no error; the visitor is still listed", async () => {
    let reads = 0;
    geoIp._setReader({ get: () => (reads += 1, record("US", "Texas", "Austin")) });
    lc = await startLiveChatServer({ mount: { lookupLocation: geoIp.lookupLocation } }); // the test client connects from 127.0.0.1
    const agent = await lc.agent();
    await agent.snapshotPromise;
    const visitor = await lc.visitor();
    await sleep(200);

    const payload = lastUpsert(agent);
    assert.ok(payload, "the visitor is listed");
    assert.deepEqual(payload.geo, { city: "", state: "", country: "", countryCode: "" });
    assert.equal(reads, 0, "a private address never reaches the database");
    for (const ip of ["10.1.2.3", "192.168.0.5", "127.0.0.1", "::1", "", "not-an-ip"]) assert.equal(await geoIp.lookupLocation(ip), null, ip);
    visitor.close();
  });

  test("an unknown public IP, and a failing database, leave the location empty without throwing", async () => {
    geoIp._setReader({ get: () => null });
    assert.equal(await geoIp.lookupLocation("203.0.113.9"), null);
    geoIp._setReader({
      get: () => {
        throw new Error("corrupt database");
      },
    });
    assert.equal(await geoIp.lookupLocation("203.0.113.9"), null);
  });

  test("the lookup is tried again when a visitor reconnects while their record still has no country", async () => {
    let calls = 0;
    const lookupLocation = async () => {
      calls += 1;
      return calls === 1 ? null : { city: "Austin", state: "Texas", country: "United States" };
    };
    lc = await startLiveChatServer({ mount: { lookupLocation } });
    const agent = await lc.agent();
    await agent.snapshotPromise;
    const first = await lc.visitor();
    await sleep(150);
    assert.equal(lastUpsert(agent).geo.country, "", "the first lookup found nothing");

    const second = await lc.visitor(); // same visitor, second tab
    await sleep(200);
    assert.equal(calls, 2);
    assert.equal(lastUpsert(agent).geo.country, "United States");
    assert.equal(lastUpsert(agent).geo.countryCode, "US");

    const third = await lc.visitor(); // the record now has a country: no more lookups
    await sleep(120);
    assert.equal(calls, 2);
    first.close();
    second.close();
    third.close();
  });
});
