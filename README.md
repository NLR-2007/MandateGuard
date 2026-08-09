<div align="center">

# 🛡️ MandateGuard

### Let AI spend your money. Decide what it's allowed to buy.

**An AI agent can stay inside your budget and still buy completely the wrong thing.**
MandateGuard compares what the human approved against what the AI actually ordered —
and answers **APPROVED** or **BLOCKED**, with reasons.

<br>

![Algorand](https://img.shields.io/badge/Algorand-TestNet-000000?style=for-the-badge&logo=algorand)
![x402](https://img.shields.io/badge/x402-payments-e8452a?style=for-the-badge)
![NVIDIA NIM](https://img.shields.io/badge/NVIDIA-NIM-76B900?style=for-the-badge&logo=nvidia)
![Telegram](https://img.shields.io/badge/Telegram-control-229ED9?style=for-the-badge&logo=telegram)

![tests](https://img.shields.io/badge/tests-73%20passing-0f6b4f?style=flat-square)
![rules](https://img.shields.io/badge/rules-10%20deterministic-12233c?style=flat-square)
![ai in decision](https://img.shields.io/badge/AI%20in%20the%20decision-none-c0271a?style=flat-square)

</div>

---

## The problem

An AI agent with a wallet is a new kind of risk. It doesn't need to be malicious
to hurt you — it just needs to be **wrong**, or **talked into** being wrong.

A spending cap doesn't help:

| The rule | What the agent bought | Under budget? |
|---|---|---|
| 1TB SSD, ₹5,000, SecureStore, no warranty | 1TB SSD, **₹4,500**, **OtherStore** | ✅ yes |
| " | **2TB** SSD, ₹4,900, SecureStore | ✅ yes |
| " | 1TB SSD, ₹4,800, SecureStore, **+ warranty** | ✅ yes |

Every one of those passes an amount check. Every one is the wrong purchase.

> **The question isn't "how much?" It's "was this what the human actually agreed to?"**

---

## What it does

You approve a rule **once**, in plain English. The agent shops on its own.
Before any money moves, ten deterministic checks compare the order against
exactly what you approved.

```mermaid
flowchart LR
    A["🗣️ Human<br/>plain English"] --> B["🤖 NVIDIA NIM<br/>drafts the rule"]
    B --> C["✍️ Human approves<br/>once"]
    C --> D["⛓️ Fingerprint<br/>written to Algorand"]
    C --> E["🛒 AI agent<br/>goes shopping"]
    E --> F{"🛡️ MandateGuard<br/>10 rules"}
    F -->|APPROVED| G["💸 x402 payment<br/>to the seller"]
    F -->|BLOCKED| H["🛑 Nothing paid<br/>reasons sent to your phone"]
    G --> I["📱 Receipt + explorer link"]

    style F fill:#12233c,color:#fff,stroke:#e8452a,stroke-width:3px
    style H fill:#fbeae8,color:#c0271a
    style G fill:#e7f3ee,color:#0f6b4f
```

**Approval moves from per-order to per-policy.** You approve the rule once;
the agent then acts alone inside it. That's what makes an autonomous agent
useful instead of terrifying.

---

## 🔥 Break It — we attack our own agent, live

A security claim is worth nothing unless you try to break it in public.

`/attack` fires **four real prompt-injection attacks** at the live model and puts
whatever comes back through the real engine. Nothing is staged.

```
☠ Direct override         AI took the bait → ₹6,200 SSD       BLOCKED  (3 rules)
☠ Pretending to be owner  AI took the bait → ₹85,000 laptop   BLOCKED  (6 rules)
☠ Manufactured emergency  AI took the bait → wrong seller     BLOCKED  (2 rules)
☠ Hidden in data          AI held the line                    APPROVED (correctly)

AI fooled: 3 of 4     Reached the money: 0     Protected: ₹95,700
```

**The AI was successfully jailbroken three times out of four, and not one rupee moved.**

Run it yourself — no UI required:

```bash
curl -X POST localhost:4021/api/security/attack \
  -H "Content-Type: application/json" -d '{}'
```

> This is a stronger claim than *"our AI is safe."* It is:
> **assume the AI is compromised — the money still cannot move.**

---

## Three applications

| | What it is | Port |
|---|---|---|
| 🛡️ **MandateGuard API** | The engine, x402, Algorand, NIM, Telegram bot | `4021` |
| 📊 **Console** | Create rules, watch verification, run attacks | `5173` |
| 🏬 **NovaMart** | An ordinary shop that *uses* MandateGuard | `5174` |

**NovaMart is deliberately separate.** It has its own name, design and codebase.
It holds no rules, no wallet and no policy logic — it makes one call before
checkout, the way a shop calls a payment processor:

```ts
const verdict = await fetch(GUARD + '/api/verify-mandate', {
  method: 'POST',
  body: JSON.stringify({ policyId, order }),
}).then((r) => r.json())

if (verdict.decision !== 'APPROVED') return refuse(verdict.violations)
```

Delete that file and MandateGuard is gone; nothing else in the shop changes.
And the shop **cannot overrule a refusal** — a blocked order simply never
renders a pay button.

---

## 📱 Telegram is the control panel

Every step reaches your phone, and your phone can drive everything.

```
/buy      the whole catalogue as buttons — tap one to order it
/shop     what the shop is doing right now
/auto     let the agent buy without asking
/ask      make it ask first  (default)
/stop     freeze all spending, instantly
/resume   allow it again
/status   /spend   /orders   /wallet
```

**The kill switch costs almost nothing.** `/stop` flips policies to `DISABLED`,
and **rule 1 of the existing engine** does the refusing. The freeze is enforced
by the same code as every other rule — no special case.

> 🔒 **A Telegram approval can never overrule the engine.** Tapping *Yes* only
> lets an order *reach* MandateGuard. It still runs all ten rules and can still
> refuse. The chat is never a spending key, and only one allowlisted chat ID can
> command the agent.

---

## The ten rules

All ten are evaluated every time — the engine never stops at the first failure,
so you see **every** reason.

| # | Rule | # | Rule |
|---|---|---|---|
| 1 | Policy is active | 6 | Per-transaction limit |
| 2 | Policy not expired | 7 | Approved seller |
| 3 | Product matches | 8 | Warranty allowed |
| 4 | Quantity matches | 9 | Receiver wallet matches |
| 5 | Maximum price | 10 | Daily limit |

### Why the AI does not decide

```
NVIDIA NIM  →  reads English, drafts a rule, picks a product   ← assistance
verifyMandate()  →  plain TypeScript, 73 unit tests            ← the decision
```

`mandateVerifier.ts` imports **no AI client**. It cannot call a model. A test
asserts the parser never emits `APPROVED` or `BLOCKED`, and another asserts the
same input always produces the same answer.

---

## ⛓️ What lives on Algorand

Three things are real, on-chain, and verifiable by anyone:

| | |
|---|---|
| **Verification fee** — 0.005 USDC | x402, pays to run the guard |
| **The purchase** — the product price | x402, priced per product, straight to the seller |
| **The rule's fingerprint** — `MG1:<sha256>` | written into a transaction note |

**Why the fingerprint matters.** An audit log is only as honest as whoever owns
the database — and we own this one. On a public ledger, changing one word of the
policy changes its fingerprint and the chain stops agreeing with us.

```bash
node demo-proof/verify-anchor.mjs MG-1029
```

That script **does not trust this server**. It recomputes the fingerprint with
its own copy of the rule and reads Algorand directly.

```
✓ fingerprints agree — the server did not invent one
✓ the chain carries exactly this policy's fingerprint
✓ confirmed in block 66084044
```

> 💡 The facilitator sponsors gas, so the agent paid holding **zero ALGO**.
> An AI agent can transact without stockpiling a native token.

---

## Quick start

**You need:** Node 20+, MySQL (XAMPP is fine), a Pera wallet on TestNet.

```bash
# 1 — the engine
cd server
cp .env.example .env        # fill it in, see below
npm install
npm start                   # http://localhost:4021

# 2 — the console
npm install && npm run dev  # http://localhost:5173

# 3 — the shop
cd storefront
npm install && npm run dev  # http://localhost:5174
```

Wait for this banner before demoing:

```
Storage: MySQL — mandateguard at 127.0.0.1:3306
✓ Telegram: listening for commands
x402:    ON  — $0.005 Test USDC on Algorand TestNet
Agent wallet: HJAST26MWWBK…  ✓ funded and ready
```

> ⚠️ Use `npm start`, **not** `npm run dev`, for the server. The watcher restarts
> on every file change and each restart leaves another Telegram poller behind —
> two pollers fight over the bot and your commands go unanswered.

### Environment

```bash
NVIDIA_API_KEY=…            # NVIDIA NIM
NVIDIA_MODEL=meta/llama-3.1-8b-instruct

AVM_ADDRESS=…               # PUBLIC address that receives the fee
ALGORAND_NETWORK=testnet    # MainNet is rejected by configuration

TELEGRAM_BOT_TOKEN=…        # from @BotFather
TELEGRAM_CHAT_ID=…          # allowlist — only this chat may command the agent

AGENT_MNEMONIC=…            # the agent's OWN throwaway TestNet wallet
```

Then opt the agent's wallet in to Test USDC — it must sign that itself:

```bash
npm run agent:optin
```

---

## The agent has its own wallet

An agent that needs a human to tap *sign* is not autonomous. It holds a
**dedicated TestNet account** with a small budget, so it can buy with nobody
present.

> **The safety is not that the key is hidden.** That key can sign anything.
> The safety is that MandateGuard decides what it is allowed to buy.

This is never your personal wallet, never MainNet, and the mnemonic lives in a
gitignored `.env` — never logged, never returned by any endpoint.

---

## Tests and proof

```bash
cd server && npm test              # 73 unit tests
node demo-proof/run-qa.mjs         # 32 — engine rules + the 402 gate
node demo-proof/run-qa2.mjs        # 16 — spend, replay, audit, reset
node demo-proof/run-qa3.mjs        # 45 — shop, agent, both modes
node demo-proof/verify-anchor.mjs  # independent on-chain proof
```

`demo-proof/` also holds captured transcripts of real runs, including
[`05-real-run.txt`](demo-proof/05-real-run.txt) — a policy anchored on Algorand
and its x402 payment settled, both re-read from the public indexer.

---

## Known limitations — stated, not hidden

- **No smart contract is deployed.** Anchoring uses the transaction **note
  field**, which is real on-chain data anyone can verify — but not on-chain
  application state. Replay protection is therefore enforced by the server
  against MySQL, not by the chain. `onChain` is `true` only after a fingerprint
  has actually been written *and read back*.
- **The decision runs server-side.** The ten rules are TypeScript, not a
  contract. What is on-chain is the money and the proof of intent.
- **TestNet only.** MainNet is rejected by configuration, by design.
- **The shop is a fixed catalogue** of 14 items, not a live marketplace. The
  seller wallets are real TestNet accounts and the money genuinely arrives.
- **Order tracking beyond payment is not built.** No shipping, no delivery.
- **`@x402/*` is pinned to 2.12.0.** Newer versions truncate the Algorand
  network id to the 32-character CAIP-2 limit. Do not bump without re-testing.

---

## Project layout

```
server/src/
  services/mandateVerifier.ts   ← the ten rules. no AI import. the decision.
  services/redTeam.ts           ← attacks our own agent with real injections
  services/agentFlow.ts         ← AI picks → engine rules → ask or act
  services/agentWallet.ts       ← the agent's own key, TestNet only
  services/chainAnchor.ts       ← reads Algorand back; never invents an id
  services/telegram*.ts         ← the control channel
  x402/                         ← payment gates, per-product pricing
  data/                         ← MySQL, catalogue, repository

src/                            ← MandateGuard console
storefront/                     ← NovaMart, the shop that uses it
demo-proof/                     ← re-runnable evidence
```

---

<div align="center">

### x402 verifies payment · MandateGuard verifies intent<br>Algorand provides proof · Telegram gives the human control

<br>

**Built for the Algorand x402 hackathon.**
TestNet only — no real money moves.

</div>
