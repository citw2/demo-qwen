# demo-qwen

**Qwen + a memory you own. One client-side-encrypted store. Erasure you can prove.**

> ⭐ **Star this repo and share it** — help every agent get portable, provable memory. [Share on X](https://x.com/intent/tweet?text=Qwen%20with%20a%20memory%20you%20own%20-%20portable%2C%20encrypted%2C%20provably%20erasable%20-%20via%20SAIHM.&url=https%3A%2F%2Fgithub.com%2Fcitw2%2Fdemo-qwen).

A tiny, runnable demo of [SAIHM](https://saihm.coti.global) wired to **Qwen**: it stores three personal facts, grounds Qwen in them, then **forgets** one fact and shows Qwen can no longer use it — provable erasure (GDPR Art. 17). The very same memory is portable to any other model.

It runs **fully offline with zero signup** against a local *blind* endpoint (included, ~130 lines), or against the real hosted SAIHM service with one environment variable.

```
git clone https://github.com/citw2/demo-qwen
cd demo-qwen
npm install
node demo.mjs
```

## Use a real Qwen answer (BYOK)

With no key set, Qwen answers in a deterministic **offline mock**, so the demo runs end to end with zero setup. Set your key to get a real answer:

```
export DASHSCOPE_API_KEY=<your key>
node demo.mjs
```

The call is Qwen’s standard **OpenAI-compatible** request (`https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions`, model `qwen-plus`). Your key is read from the environment and sent only to Qwen’s own API. Override the base URL or model id without editing code via `SAIHM_QWEN_URL` / `SAIHM_QWEN_MODEL`.

## Why this matters

A per-vendor “memory” feature keeps your context inside one vendor’s account. SAIHM gives you memory that is:

1. **Yours / portable.** One live store grounds Qwen *and* every other model (Claude, DeepSeek, Qwen, Kimi, GLM, GPT, a local model, your own agent) — no per-vendor export, no lossy one-time import.
2. **Non-custodial.** Every cell is sealed client-side; the endpoint only ever holds ciphertext and never sees your keys.
3. **Provably erasable.** `forget` crypto-shreds the cell (its wrapped key is destroyed). `recall` returns nothing for it and every model loses access at once — not a soft “hidden” flag. This is what GDPR Art. 17 actually asks for.

## Go live against the real SAIHM service

The local sandbox is a throwaway stand-in so you can try the protocol offline — it is **not** the SAIHM service and stores nothing beyond the current process. To run the same demo against the real, hosted, blind endpoint:

1. **Join SAIHM** at **[saihm.coti.global/join](https://saihm.coti.global/join)** and onboard to obtain your JWT. (Going live requires a paid membership — there is no free tier.)
2. Point the demo at the live endpoint:

   ```
   export SAIHM_ENDPOINT_URL=https://saihm.coti.global/mcp
   export SAIHM_AUTH_HEADER="Bearer <your-onboard-JWT>"
   export SAIHM_MASTER_SECRET_HEX=<at least 64 hex chars, generated and held only by you>
   node demo.mjs
   ```

Your master secret never leaves your machine; the endpoint only ever receives ciphertext.

## How it works

- [`@saihm/mcp-server-pro`](https://www.npmjs.com/package/@saihm/mcp-server-pro) (the client) seals every cell with [`@saihm/client-pro`](https://www.npmjs.com/package/@saihm/client-pro): an **ML-DSA-65** identity signs it, a per-cell **AES-256-GCM** key encrypts it, and that key is wrapped under a key-encryption key derived from *your* master secret. Sharing uses **ML-KEM-768**. All of this happens in your process.
- Only opaque ciphertext is POSTed to the endpoint. [`sandbox.mjs`](./sandbox.mjs) is a complete, readable *blind operator*: it stores and returns ciphertext and **never holds a key**.
- `forget` tells the endpoint to destroy the wrapped key. Without it the ciphertext is unrecoverable noise — that is the “crypto-shred”.

## Built on / see also

- **[demo-cross-model-memory](https://github.com/citw2/demo-cross-model-memory)** — the same memory across Claude, DeepSeek, Qwen, Kimi, GLM, and GPT, side by side.
- **[`@saihm/mcp-server-pro`](https://github.com/SAIHM-Admin/saihm-mcp-server-pro)** — the production sealing client this demo uses ([npm](https://www.npmjs.com/package/@saihm/mcp-server-pro)).
- **[`@saihm/client-pro`](https://github.com/SAIHM-Admin/saihm-client-pro)** — the post-quantum client crypto library ([npm](https://www.npmjs.com/package/@saihm/client-pro)).
- **Learn more:** [AI memory needs a standard](https://saihm.coti.global/blog/2026-05-18-ai-memory-needs-a-standard) · [What makes SAIHM different](https://saihm.coti.global/blog/2026-05-31-what-makes-saihm-different).
- **Join the protocol:** [saihm.coti.global/join](https://saihm.coti.global/join).

## License

Apache-2.0 © SAIHM
