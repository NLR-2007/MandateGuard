# Demo Proof

Backup evidence for the live demo. Everything here is **real captured output**
from the running system — nothing is mocked up or edited.

## What is already captured (automated)

| File | What it proves |
|---|---|
| `01-engine-and-402.txt` | Health check, all 12 MandateGuard rule cases with their exact block reasons, and the HTTP 402 gate (including proof the handler does **not** run without payment). 32/32 passed. |
| `02-spend-replay-audit.txt` | Execution, duplicate-execution refusal, replay protection, the daily-limit block, audit fields and demo reset. 16/16 passed. |
| `03-nvidia-nim.txt` | A live NVIDIA NIM call producing all 8 policy fields correctly, plus the no-invention safety test. |
| `04-failure-paths.txt` | AI outage and facilitator outage handled gracefully — service stays alive, nothing faked. |
| `run-qa.mjs`, `run-qa2.mjs` | The harnesses, so any claim above can be re-run: `node demo-proof/run-qa.mjs` |
| `verify-anchor.mjs` | Independent proof of the on-chain anchor. Recomputes the fingerprint with its own copy of the rule and reads Algorand TestNet directly, without trusting our server: `node demo-proof/verify-anchor.mjs MG-1001` |

Re-run everything with the backend up:

```bash
node demo-proof/run-qa.mjs
node demo-proof/run-qa2.mjs
```

## Screenshots you still need to take (5 minutes)

I cannot drive a browser, so these are yours. Save them here with these names:

| File to save | How to get it |
|---|---|
| `05-http-402.png` | Dashboard → Verify with x402 → screenshot the **Payment Required** stage |
| `06-wallet-payment.png` | The Pera signing screen showing 0.005 Test USDC |
| `07-algorand-tx.png` | The explorer page after clicking *View on Algorand Explorer* |
| `08-approved.png` | The result screen: **x402 VERIFIED** + **MandateGuard APPROVED** |
| `09-blocked.png` | The attack result: **x402 VERIFIED** + **MandateGuard BLOCKED** with 4 reasons |
| `10-audit-history.png` | The History page with both runs |
| `11-nim-draft.png` | Dashboard step 2, the AI-generated draft with a red missing field |
| `12-anchor-explorer.png` | The explorer page for the **mandate anchor**, with the `MG1:…` note field visible |

**Before saving any screenshot, check it does not show:**

- the NVIDIA API key
- a seed phrase, mnemonic or private key
- anything beyond a public wallet address

The app only ever displays shortened public addresses, so a normal screenshot is
safe. Just be careful if your terminal or `.env` is visible on screen.

## If the live demo fails

Open this folder and talk through it. The captured text files are genuine
transcripts — you can honestly say *"this is real output from the system, taken
before the demo"*, which is far stronger than a slide.
