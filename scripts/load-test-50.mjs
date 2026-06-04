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
const PLAN_CONCURRENT = Number(process.env.LOAD_TEST_PLAN_CONCURRENT || 2);
const STRESS = process.env.LOAD_TEST_STRESS === "1";

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

function parseChatSse(buf) {
  let gotDone = false;
  let chunkChars = 0;
  let error = null;
  let code = null;
  for (const line of buf.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const data = JSON.parse(line.slice(6));
      if (data.done === true) gotDone = true;
      if (typeof data.chunk === "string") chunkChars += data.chunk.length;
      if (data.error) {
        error = data.error;
        code = data.code ?? null;
      }
    } catch {
      /* ignore */
    }
  }
  return { gotDone, chunkChars, error, code };
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
    const text = await res.text().catch(() => "");
    return {
      i,
      ok: false,
      ms: Date.now() - t0,
      err: `HTTP ${res.status} ${text.slice(0, 80)}`,
    };
  }
  const reader = res.body?.getReader();
  if (!reader) {
    return { i, ok: false, ms: Date.now() - t0, err: "no body" };
  }
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
  }
  const { gotDone, chunkChars, error, code } = parseChatSse(buf);
  if (error) {
    return {
      i,
      ok: false,
      ms: Date.now() - t0,
      err: code ? `${code}: ${error}` : error,
      chunkChars,
    };
  }
  const ok = gotDone || chunkChars >= 80;
  return {
    i,
    ok,
    ms: Date.now() - t0,
    err: ok
      ? gotDone
        ? null
        : "partial stream (chunks ok, no done — check nginx timeout)"
      : "empty stream",
    chunkChars,
    gotDone,
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
    console.log(
      "Sample errors:",
      fail.slice(0, 5).map((f) => `${f.err} (chunks=${f.chunkChars ?? 0})`)
    );
  }
  const partial = results.filter((r) => r.ok && r.gotDone === false);
  if (partial.length) {
    console.log(
      `Partial OK (no done event): ${partial.length} — often nginx proxy_read_timeout < 120s on SSL vhost`
    );
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
    const planCount = STRESS ? Math.min(CONCURRENT, 10) : PLAN_CONCURRENT;
    console.log(
      STRESS
        ? `Starting ${planCount} plan requests in parallel (STRESS mode)...`
        : `Starting ${planCount} plan requests (${PLAN_CONCURRENT} at a time, realistic)...`
    );
    const planResults = [];
    if (STRESS) {
      planResults.push(
        ...(await Promise.all(
          Array.from({ length: planCount }, (_, i) => generatePlan(token, i + 1))
        ))
      );
    } else {
      for (let i = 0; i < planCount; i++) {
        planResults.push(await generatePlan(token, i + 1));
      }
    }
    summarize("PLAN (JSON)", planResults);
  }

  console.log(
    "\nNote: 50 parallel chats on 1 CPU VPS is a stress test — expect minutes of wait."
  );
  console.log(
    "Realistic: LOAD_TEST_CONCURRENT=8  LOAD_TEST_PLAN_CONCURRENT=1  (omit LOAD_TEST_STRESS)"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
