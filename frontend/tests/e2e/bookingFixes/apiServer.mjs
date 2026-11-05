// A small stand-in API for the booking-fix browser tests. It is not the real backend: it records what the browser sends and lets a test
// move the visitor's "IP country" between requests (the "geo" setting), which is the whole point of the currency test. Real payment,
// real S3 and a real database are out of scope here (they have their own backend tests).
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// The sign-up form's country / state lists come from the real /api/locations route (static data, no database).
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "backend");
const requireBackend = createRequire(path.join(backendRoot, "package.json"));

const PRICES = { general: { price: 49, priceEur: 45, priceGbp: 39, priceInr: 3999 } };
const TREE = [
  { _id: "cat-general", name: "General & Everyday Care", icon: "stethoscope", price: 49, currency: "USD", specialties: [] },
  {
    _id: "cat-women",
    name: "Women's Health",
    icon: "venus",
    price: 50,
    currency: "USD",
    specialties: [
      { _id: "spec-obgyn", name: "Obstetrics and Gynaecology", icon: "stethoscope", conditions: [{ _id: "cond-pcos", name: "PCOS", icon: "stethoscope" }] },
    ],
  },
];
const GEO = {
  US: { currency: "USD", country: "US", source: "ip" },
  GB: { currency: "GBP", country: "GB", source: "ip" },
  DE: { currency: "EUR", country: "DE", source: "ip" },
  IN: { currency: "INR", country: "IN", source: "ip" },
};
const freshState = () => ({
  geo: "US",
  geoFails: false,
  loggedIn: false,
  geoCalls: 0,
  intents: [],
  uploads: [],
  consultations: [],
  appointments: [],
  registers: [],
});

export async function startApiServer() {
  const express = requireBackend("express");
  const locationsApp = express();
  locationsApp.use("/api/locations", requireBackend(path.join(backendRoot, "routes", "locations.js")));
  const state = freshState();
  const user = { _id: "patient-1", name: "Test Patient", email: "patient@e2e.test", role: "user" };

  const readBody = (req) =>
    new Promise((resolve) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch {
          resolve({});
        }
      });
    });
  const send = (res, status, body) => {
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;
    if (p.startsWith("/api/locations")) return locationsApp(req, res);
    if (req.method === "POST" && p === "/api/auth/send-register-otp") {
      await readBody(req);
      return send(res, 200, { msg: "OTP sent." });
    }
    if (req.method === "POST" && p === "/api/auth/register") {
      state.registers.push(await readBody(req));
      state.loggedIn = true;
      return send(res, 201, { accessToken: "a", refreshToken: "r", user });
    }
    if (req.method === "GET" && p === "/api/geo/currency") {
      state.geoCalls += 1;
      if (state.geoFails) return send(res, 503, { msg: "down" });
      return send(res, 200, GEO[state.geo]);
    }
    if (req.method === "GET" && p === "/api/pricing") return send(res, 200, PRICES);
    if (req.method === "GET" && p === "/api/appointment-tree") return send(res, 200, TREE);
    if (p === "/api/auth/refresh") return state.loggedIn ? send(res, 200, {}) : send(res, 401, { msg: "no session" });
    if (p === "/api/auth/me") return state.loggedIn ? send(res, 200, { user }) : send(res, 401, { msg: "no session" });
    if (req.method === "POST" && p === "/api/auth/login") {
      await readBody(req);
      state.loggedIn = true;
      return send(res, 200, { accessToken: "a", refreshToken: "r", user });
    }
    if (req.method === "POST" && p === "/api/upload/presign") {
      const body = await readBody(req);
      const key = `uploads/${Date.now()}-${body.originalName}`;
      return send(res, 200, {
        uploadUrl: `/api/__s3/${encodeURIComponent(key)}`,
        headers: { "Content-Type": body.contentType },
        file: { url: `https://s3.stub/${key}`, key, name: body.originalName, type: body.contentType, size: body.size },
      });
    }
    if (req.method === "PUT" && p.startsWith("/api/__s3/")) {
      let bytes = 0;
      req.on("data", (c) => {
        bytes += c.length;
      });
      req.on("end", () => {
        state.uploads.push({ key: decodeURIComponent(p.slice("/api/__s3/".length)), bytes });
        res.writeHead(200);
        res.end();
      });
      return undefined;
    }
    if (req.method === "POST" && p === "/api/payments/create-intent-by-amount") {
      const body = await readBody(req);
      const geo = GEO[state.geo];
      const record = PRICES.general;
      const amount = { USD: record.price, EUR: record.priceEur, GBP: record.priceGbp, INR: record.priceInr }[geo.currency];
      state.intents.push({ body, currency: geo.currency, amountCents: amount * 100 });
      return send(res, 200, { clientSecret: "pi_e2e_secret_stub", id: `pi_${state.intents.length}`, amountCents: amount * 100, currency: geo.currency });
    }
    if (req.method === "POST" && p === "/api/category-consultation") {
      state.consultations.push(await readBody(req));
      return send(res, 201, { msg: "ok" });
    }
    if (req.method === "POST" && p === "/api/appointments") {
      state.appointments.push(await readBody(req));
      return send(res, 201, { msg: "ok" });
    }
    if (p === "/__state") return send(res, 200, state);
    if (req.method === "POST" && p === "/__reset") {
      Object.assign(state, freshState());
      return send(res, 200, {});
    }
    if (req.method === "POST" && p === "/__set") {
      Object.assign(state, await readBody(req));
      return send(res, 200, {});
    }
    return send(res, 404, { msg: `not part of this test: ${p}` });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
