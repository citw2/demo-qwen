#!/usr/bin/env node
// SAIHM memory for Qwen — one client-side-encrypted memory you own; provable forget.
//
//   git clone https://github.com/citw2/demo-qwen
//   cd demo-qwen && npm install && node demo.mjs
//
// Optional, for a LIVE Qwen answer instead of the offline mock:
//   export DASHSCOPE_API_KEY=...
//
// Optional, to run against the REAL hosted SAIHM service (paid; see README "Go live"):
//   export SAIHM_ENDPOINT_URL=https://saihm.coti.global/mcp
//   export SAIHM_AUTH_HEADER="Bearer <your-onboard-JWT>"
//   export SAIHM_MASTER_SECRET_HEX=<at least 64 hex chars, held only by you>

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
    const authHeader = process.env.SAIHM_AUTH_HEADER;
    const secretHex = process.env.SAIHM_MASTER_SECRET_HEX;
    if (!authHeader || !secretHex) throw new Error('LIVE mode needs SAIHM_AUTH_HEADER (Bearer <JWT>) and SAIHM_MASTER_SECRET_HEX too.');
    const saihm = new SaihmProClient(liveUrl, authHeader, fromHex(secretHex.trim()), {}); // tier resolved from your JWT
    return { saihm, where: `${liveUrl}  (LIVE)`, close: async () => {} };
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
    line('Run it for real : set SAIHM_ENDPOINT_URL=https://saihm.coti.global/mcp (see README).');
    line('Join SAIHM      : https://saihm.coti.global/join');
    rule();
  } finally {
    await close();
  }
}

main().catch((e) => { console.error('demo failed:', e?.message ?? e); process.exit(1); });
