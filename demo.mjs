#!/usr/bin/env node
// SAIHM memory for Qwen — one client-side-encrypted memory you own; provable forget.
//
//   git clone https://github.com/citw2/demo-qwen
//   cd demo-qwen && npm install && node demo.mjs
//
// Optional, for a LIVE Qwen answer instead of the offline mock:
//   export DASHSCOPE_API_KEY=...
//
// Optional, to run against the REAL hosted SAIHM service (start free, no card; see README "Go live"):
//   export SAIHM_ENDPOINT_URL=https://saihm.coti.global/mcp
//   export SAIHM_MASTER_SECRET_HEX=<at least 64 hex chars, held only by you>
//   export SAIHM_TIER=FREE   # free tier — run `npx -y @saihm/mcp-server-pro free-join` once first
//   # …or a paid Pro membership instead:  export SAIHM_AUTH_HEADER="Bearer <your-onboard-JWT>"

import { randomBytes } from 'node:crypto';
import { deriveIdentity, toHex, fromHex } from '@saihm/client-pro';
import { SaihmProClient } from '@saihm/mcp-server-pro';
import { startSandbox } from './sandbox.mjs';
import { ask, PROVIDERS } from './models.mjs';

const MODEL = 'qwen';
const line = (s = '') => console.log(s);
const rule = () => line('-'.repeat(72));
const QUESTION = 'Briefly: what do you know about me, and is there anything I should avoid medically?';

async function ground(facts) {
  const system =
    'You are a helpful assistant. Use ONLY these remembered facts about the user; ' +
    'do not invent or assume anything not listed.\nRemembered facts:\n' +
    (facts.length ? facts.map((f) => '- ' + f).join('\n') : '(none)');
  line(await ask(MODEL, system, QUESTION, facts));
}

async function connect() {
  const liveUrl = process.env.SAIHM_ENDPOINT_URL;
  if (liveUrl) {
    const secretHex = process.env.SAIHM_MASTER_SECRET_HEX;
    if (!secretHex) throw new Error('LIVE mode needs SAIHM_MASTER_SECRET_HEX (>= 64 hex chars, held only by you).');
    const authHeader = process.env.SAIHM_AUTH_HEADER;   // paid: a Bearer JWT you already hold
    const tier = process.env.SAIHM_TIER;                // free: SAIHM_TIER=FREE (run `npx -y @saihm/mcp-server-pro free-join` once first)
    if (!authHeader && !tier) throw new Error('LIVE mode needs SAIHM_AUTH_HEADER (Bearer <JWT>), or SAIHM_TIER=FREE for the free tier (run `npx -y @saihm/mcp-server-pro free-join` first).');
    const opts = {};
    if (tier) opts.tier = tier;
    if (process.env.SAIHM_PAYMENT_METHOD) opts.paymentMethod = process.env.SAIHM_PAYMENT_METHOD;
    const saihm = new SaihmProClient(liveUrl, authHeader, fromHex(secretHex.trim()), opts); // tier from your JWT, or SAIHM_TIER to self-onboard
    return { saihm, where: `${liveUrl}  (LIVE${tier ? ', ' + tier : ''})`, close: async () => {} };
  }
  const { url, close } = await startSandbox();
  const master = randomBytes(32); // a throwaway identity, held only on this machine
  const authHeader = `Bearer ${toHex(deriveIdentity(master).agentIdHash)}`;
  const saihm = new SaihmProClient(url, authHeader, master, { tier: 'SANDBOX' });
  return { saihm, where: `${url}  (local sandbox)`, close };
}

async function main() {
  const { saihm, where, close } = await connect();
  try {
    const label = PROVIDERS[MODEL]?.label ?? MODEL;
    rule(); line(`SAIHM memory for ${label}`); rule();
    const st = await saihm.status();
    line(`agent id : ${saihm.agentIdHash.slice(0, 16)}...`);
    line(`endpoint : ${where}`);
    line(`custody  : ${st.custody}  (the endpoint stores ciphertext only; it holds no key)`);
    line(`model    : ${label}  (set ${PROVIDERS[MODEL]?.keyEnv} for a live answer)`);
    line();

    // 1) Remember three personal facts — each sealed client-side before it leaves the process.
    const facts = [
      'My name is Dana Okafor.',
      'I am allergic to penicillin.',
      'I am building a Rust ray tracer called Lumen.',
    ];
    const cellOf = {};
    for (const f of facts) cellOf[f] = (await saihm.remember(f)).cellId;
    line(`Sealed and stored ${facts.length} facts (the endpoint now holds ${(await saihm.status()).activeShardCount} opaque shards).`);
    line();

    // 2) Ground the model in the SAME memory.
    rule(); line(`(1) ${label}, grounded in your SAIHM memory:`); rule();
    await ground((await saihm.recall()).map((c) => c.plaintext));
    line();

    // 3) Forget the medical fact (crypto-shred), then prove it is gone.
    rule(); line('(2) Provable erasure -- forget the allergy, then ask the same question again:'); rule();
    const allergy = 'I am allergic to penicillin.';
    await saihm.forget(cellOf[allergy]);
    const gone = (await saihm.recallOne(cellOf[allergy])) === null;
    line(`forget("${allergy}")  ->  recall now returns: ${gone ? 'NOTHING (crypto-shredded)' : 'STILL PRESENT (unexpected)'}`);
    line();
    await ground((await saihm.recall()).map((c) => c.plaintext));
    line();

    rule();
    line('Your memory is yours: portable to every other model, and erasure you can prove.');
    line('Try it live free: npx -y @saihm/mcp-server-pro free-join, then set SAIHM_ENDPOINT_URL + SAIHM_TIER=FREE (see README).');
    line('Or go Pro       : https://saihm.coti.global/join');
    rule();
  } finally {
    await close();
  }
}

main().catch((e) => {
  const m = e?.message ?? String(e);
  console.error('demo failed:', m);
  if (process.env.SAIHM_TIER === 'FREE' && !process.env.SAIHM_AUTH_HEADER && /401|unauthorized|entitl/i.test(m))
    console.error('hint: run `npx -y @saihm/mcp-server-pro free-join` once first to activate the free tier (a one-time GitHub check, no card).');
  process.exit(1);
});
