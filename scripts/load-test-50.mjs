#!/usr/bin/env node
/**
 * Load test: N concurrent chat streams + optional plan requests.
 *
 * Usage (on VPS, from repo dir):
 *   export LOAD_TEST_URL=https://orionaii.com
 *   export LOAD_TEST_EMAIL=admin@test.com
 *   export LOAD_TEST_PASSWORD=secret
 *   node scripts/load-test-50.mjs
 *
 * Or inside app container:
 *   docker compose --env-file .env.docker exec orion-app node scripts/load-test-50.mjs
 */
const BASE = (process.env.LOAD_TEST_URL || "http://127.0.0.1:3001").replace(
  /\/$/,
  ""
);
const EMAIL = process.env.LOAD_TEST_EMAIL;
const PASSWORD = process.env.LOAD_TEST_PASSWORD;
const CONCURRENT = Number(process.env.LOAD_TEST_CONCURRENT || 50);
const RUN_PLAN = process.env.LOAD_TEST_PLAN !== "0";

if (!EMAIL || !PASSWORD) {
  console.error("Set LOAD_TEST_EMAIL and LOAD_TEST_PASSWORD");
  process.exit(1);
}

async function login() {
  const res = await fetch(`${BASE}/api/auth-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  if (!data.token) throw new Error("No token in login response");
  return data.token;
}

async function chatStream(token, i) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/chat?stream=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Stream": "true",
    },
    body: JSON.stringify({
      message: `Load test user ${i}: I feel sad and want advice.`,
      history: [],
    }),
  });
  if (!res.ok) {
    return { i, ok: false, ms: Date.now() - t0, err: `HTTP ${res.status}` };
  }
  const reader = res.body?.getReader();
  if (!reader) {
    return { i, ok: false, ms: Date.now() - t0, err: "no body" };
  }
  const dec = new TextDecoder();
  let buf = "";
  let chars = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    chars += value?.length || 0;
  }
  const hasDone = buf.includes('"done"');
  return {
    i,
    ok: hasDone,
    ms: Date.now() - t0,
    err: hasDone ? null : "stream ended without done",
    chars,
  };
}

async function generatePlan(token, i) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      contextHistory:
        "User: I am sad after a breakup.\n\nOrion: Are you a man or a woman? Is this about an ex?",
      conversationId: undefined,
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { i, ok: false, ms, err: `HTTP ${res.status} ${text.slice(0, 80)}` };
  }
  const data = await res.json();
  return {
    i,
    ok: !!data.plan?.steps?.length,
    ms,
    err: data.plan?.steps?.length ? null : "no plan steps",
  };
}

function summarize(label, results) {
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const times = ok.map((r) => r.ms).sort((a, b) => a - b);
  const p = (pct) =>
    times.length ? times[Math.floor((times.length * pct) / 100)] : 0;
  console.log(`\n=== ${label} ===`);
  console.log(`OK: ${ok.length}/${results.length}  FAIL: ${fail.length}`);
  if (times.length) {
    console.log(
      `Latency ms — min: ${times[0]}  p50: ${p(50)}  p95: ${p(95)}  max: ${times[times.length - 1]}`
    );
  }
  if (fail.length) {
    console.log("Sample errors:", fail.slice(0, 5).map((f) => f.err));
  }
}

async function main() {
  console.log(`Target: ${BASE}  concurrent: ${CONCURRENT}`);
  const token = await login();
  console.log("Login OK");

  const chatJobs = Array.from({ length: CONCURRENT }, (_, i) =>
    chatStream(token, i + 1)
  );
  console.log(`Starting ${CONCURRENT} chat streams...`);
  const chatResults = await Promise.all(chatJobs);
  summarize("CHAT (stream)", chatResults);

  if (RUN_PLAN) {
    const planJobs = Array.from({ length: Math.min(CONCURRENT, 10) }, (_, i) =>
      generatePlan(token, i + 1)
    );
    console.log(`Starting ${planJobs.length} plan requests (max 10 at once)...`);
    const planResults = await Promise.all(planJobs);
    summarize("PLAN (JSON)", planResults);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
