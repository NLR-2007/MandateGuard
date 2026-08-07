# MandateGuard

**AI Agent Spend Policy Engine — x402 + Algorand TestNet + NVIDIA NIM**

> Let AI spend, but keep human intent in control.

An AI agent can stay inside your spending limit and still buy the wrong thing.
MandateGuard compares what the human approved against what the AI actually
ordered, and answers **APPROVED** or **BLOCKED** with exact reasons.

---

## Problem

AI agents are starting to spend money on our behalf. The usual control is a
spending limit — "don't spend more than ₹5,000".

That is not enough. Here is a real example from our demo:

| | Human approved | AI ordered |
|---|---|---|
| Product | 1TB SSD | 1TB SSD ✓ |
| Quantity | 1 | **2** |
| Price | ≤ ₹5,000 | ₹4,900 ✓ |
| Seller | SecureStore | **OtherStore** |
| Warranty | not allowed | **added** |
| Receiver wallet | ALGO-SECURE-STORE | **ALGO-UNKNOWN-WALLET** |

An amount-only check sees ₹4,900 < ₹5,000 and says **PASS**. The money was in
budget. The purchase was wrong.

## Solution

MandateGuard sits between the AI agent and the payment. It independently
compares the AI's final order against the human-approved policy, using ten
deterministic rules, and returns APPROVED or BLOCKED **with the exact reasons**.

In the example above it returns BLOCKED with four reasons — while still agreeing
that the price was fine.

## Why MandateGuard

- **Intent, not just amount.** Quantity, seller, add-ons and the payment
  destination are all checked, not only the total.
- **The AI never judges itself.** The decision is plain TypeScript. Same input,
  same answer, every time — there is a test that proves it.
- **Every block explains itself.** Never a bare "BLOCKED"; always sentences a
  human can act on.
- **Pay-per-check.** x402 makes per-call verification affordable for agents, with
  no signup or API keys.
- **Auditable.** Every decision is recorded with its payment proof and mandate
  status.

---

## The idea in one picture

```
Human
  ↓
NVIDIA NIM        reads plain English, drafts a policy (assistance only)
  ↓
Human approves    nothing becomes real until a person clicks Approve
  ↓
AI Agent          picks an item and prepares an order
  ↓
x402              asks for a small Test USDC fee for the verification API
  ↓
Algorand TestNet  records the payment
  ↓
MandateGuard      deterministic TypeScript compares policy vs order
  ↓
APPROVED / BLOCKED
```

**Each layer has exactly one job:**

| Layer | Job |
|---|---|
| **NVIDIA NIM** | Understands language. Never decides anything. |
| **x402** | Verifies **payment**. Never judges the order. |
| **Algorand** | Provides the **blockchain record** of the payment. |
| **MandateGuard** | Verifies **intent**. Makes the final call, in plain code. |

> **x402 verifies payment. MandateGuard verifies intent. Algorand provides proof.**

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Node.js + Hono + TypeScript |
| Database | MySQL / MariaDB (XAMPP) |
| AI | NVIDIA NIM (`meta/llama-3.1-70b-instruct`) |
| Security | MandateGuard deterministic policy engine |
| Payment | x402 |
| Blockchain | Algorand TestNet |
| Currency | Test USDC (ASA 10458941) |
| Facilitator | GoPlausible |

## Pages

| Route | What it does |
|---|---|
| `/` | The problem, the solution, the flow |
| `/dashboard` | **Control Center** — the whole journey in one guided run |
| `/unsafe-demo` | The problem: an amount-only check passes an unsafe order |
| `/policy` | Create a policy by hand, or with AI help |
| `/order` | AI order + verification (free or paid route) |
| `/verify` | The last decision, with blockchain proof |
| `/history` | Audit log of every verification |
| `/history/:verificationId` | One transaction in full, with its timeline |
| `/architecture` | The four layers, one job each |

A user can successfully pay the API fee and *still* have their order blocked —
those are two separate answers, and the UI shows them separately.

---

## Why the decision is not made by AI

The APPROVED/BLOCKED answer comes from ordinary `if` statements in
[`server/src/services/mandateVerifier.ts`](server/src/services/mandateVerifier.ts).
No model, no randomness, no network call takes part in it. The same policy and
order always produce the same answer — there is a unit test that asserts exactly
that.

The ten rules checked:

| # | Rule | Comparison |
|---|---|---|
| 1 | Policy Active | `status === 'ACTIVE'` |
| 2 | Policy Not Expired | `now < expiresAt` |
| 3 | Product | trim + lowercase |
| 4 | Quantity | exact equality |
| 5 | Maximum Price | `price <= maxPrice` |
| 6 | Per Transaction Limit | `price <= perTransactionLimit` |
| 7 | Approved Seller | trim + lowercase |
| 8 | Warranty Policy | blocks unapproved add-ons |
| 9 | Receiver Wallet | **exact**, case-sensitive |
| 10 | Daily Limit | `spentToday + price <= dailyLimit` |

All ten are mandatory. Every rule is evaluated even after one fails, so the user
always sees the complete list of problems, not just the first.

---

## Setup

### Requirements

- Node.js 20+
- **MySQL or MariaDB running** (XAMPP is fine — start MySQL in the control panel)
- An Algorand **TestNet** wallet (Pera, Defly or Lute)
- An NVIDIA NIM API key (optional — the app works without it)

The server creates the `mandateguard` database and its tables on first start.
You do not need to run any SQL by hand.

### 1. Backend

```bash
cd server
npm install
cp .env.example .env      # then edit .env
npm run dev               # http://localhost:4021
```

### 2. Frontend

```bash
npm install
npm run dev               # http://localhost:5173
```

Start the backend **first**. If port 5173 is taken, Vite silently moves to 5174.

---

## Environment variables

`server/.env` — never committed, never sent to the browser.

```env
# NVIDIA NIM (optional)
NVIDIA_API_KEY=your_nvidia_api_key_here
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=meta/llama-3.1-70b-instruct

# x402 + Algorand
AVM_ADDRESS=your_algorand_testnet_address_here
FACILITATOR_URL=https://facilitator.goplausible.xyz
ALGORAND_NETWORK=testnet
```

`AVM_ADDRESS` is the **public** address that receives the API fee — an account
number, not a secret. If it is missing, the paid endpoint answers
*"AVM_ADDRESS is required for x402 payments."* and every free endpoint keeps
working.

> **Never put a seed phrase, mnemonic or private key in `.env`, in the code, or
> anywhere else.** MandateGuard never needs one. All signing happens inside your
> wallet.

---

## Wallet setup (TestNet, ~10 minutes, all free)

1. Install **Pera Wallet** and create an account.
2. Switch to TestNet: *Settings → Developer Settings → Node Settings → TestNet*.
3. Get free TestNet ALGO: <https://bank.testnet.algorand.network>
4. **Opt in to Test USDC**: in Pera tap *+ Add Asset*, search asset id
   **`10458941`**, confirm. On Algorand an account cannot receive an asset until
   it opts in — skip this and the payment cannot work.
5. Get free Test USDC: <https://faucet.circle.com> → network **Algorand Testnet**.

You need roughly 0.3 ALGO and at least 0.005 Test USDC.

---

## How the x402 payment works

```
Frontend                 Backend                Facilitator        Algorand
   │ POST /api/x402/verify-mandate                    │                │
   ├────────────────────────►│                        │                │
   │      402 Payment Required (price, asset, payTo)  │                │
   │◄────────────────────────┤                        │                │
   │ build 2-txn group, wallet signs                  │                │
   │ (setup app-call + USDC transfer)                 │                │
   │ retry with Payment-Signature header              │                │
   ├────────────────────────►├───────────────────────►│───────────────►│
   │                         │       verified + settled                │
   │                         │◄───────────────────────┤                │
   │                         │ MandateGuard runs (deterministic)       │
   │  200 OK: decision + violations + PAYMENT-RESPONSE│                │
   │◄────────────────────────┤                        │                │
```

- Fee: **0.005 Test USDC** per verification
- Asset: **10458941** (USDC on Algorand TestNet)
- Network: `algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=`
- Facilitator: GoPlausible (it also sponsors the ALGO transaction fee)

The real Algorand transaction id arrives in the `PAYMENT-RESPONSE` header. If the
facilitator does not return one, the UI says so — **no transaction id is ever
invented**.

---

## API

### Free (no payment)

```
GET  /health                    service + configuration status
POST /api/policies              create a policy (server generates MG-XXXX)
GET  /api/policies              list policies
GET  /api/policies/:id          one policy
POST /api/verify-mandate        MandateGuard decision, no payment layer
GET  /api/audit                 audit log, newest first
POST /api/executions            mark an approved verification as executed
POST /api/ai/parse-policy       English → draft policy (NVIDIA NIM)
POST /api/ai/prepare-order      AI agent picks from the demo catalog
POST /api/ai/simulate-unsafe-order   fixed attack sample (no AI involved)
GET  /api/mandates/:id          mandate proof status
POST /api/mandates/:id/mark-used consume a mandate (replay protection)
GET  /api/audit/:verificationId  one record + its timeline
GET  /api/system/status          which services are green (no secrets)
GET  /api/system/timeline/:reqId real timestamps for one journey
POST /api/demo/reset             clear in-memory demo state
```

### Paid (x402)

```
POST /api/x402/verify-mandate   402 until 0.005 Test USDC is paid
```

Nothing in the handler runs until the facilitator confirms payment.

---

## Demo procedure

The fastest path is **`/dashboard` → Start AI Purchase**, which walks all eight
steps in one page: instruction → AI draft → your approval → AI order → x402
payment → decision → blockchain proof → execution.

Use the **Demo Scenario** switch at the top:

- **Safe AI Order** — NVIDIA NIM picks a matching item → **APPROVED**
- **Unsafe AI Order** — fixed sample attack order → **BLOCKED** with 4 reasons

**Reset Demo** clears the in-memory state so you can run it again. It cannot and
does not touch Algorand history.

### Step-by-step (long form)

1. **Create Policy → Create with AI** — type:
   *"Buy one 1TB SSD below ₹5000 from SecureStore. No warranty. Only pay
   ALGO-SECURE-STORE. Maximum ₹5000 per transaction. Daily limit ₹10000."*
2. NIM fills the form. Anything you did not say stays **empty and red** — it
   never guesses. Fill the expiry.
3. Click **Approve Policy** → a real `MG-XXXX` is created by the server.
4. **AI Order → Ask AI to Prepare Order** → badge *Generated by NVIDIA NIM*.
5. **Connect Algorand Wallet**, then **Verify with x402 + MandateGuard**.
6. Watch the seven stages. Sign in Pera when asked.
7. Result: **x402 Payment ✓ VERIFIED** and **MandateGuard ✓ APPROVED**, plus the
   TestNet transaction and an explorer link.
8. Go back → **Simulate Unsafe AI Order** → verify again.
9. Result: **x402 Payment ✓ VERIFIED** but **MandateGuard ✕ BLOCKED**, with four
   reasons. *"Payment for verification succeeded. The unsafe AI purchase was
   blocked."*

That contrast is the whole pitch.

---

## Tests

```bash
cd server
npm test          # 55 tests, no network, no API credits
npm run test:nim  # optional: one live NVIDIA call
npm run typecheck
```

The AI tests inject a fake completion function, so they never call NVIDIA and
cost nothing.

---

## Mandate proof and replay protection

Each policy is reduced to a canonical form (fixed field order, trimmed,
lowercased) and hashed with **SHA-256**. Only compact identifying fields are
included — never natural language, AI output or personal data.

A mandate can be `ACTIVE`, `USED`, `EXPIRED` or `NOT_REGISTERED`. Once consumed
it can never approve again.

> **Paying the verification fee does NOT consume a mandate.** Paying for a check
> and executing a purchase are different things. Only
> `POST /api/mandates/:id/mark-used` consumes one.

### ⚠️ Known limitation: the mandate proof is not on-chain yet

In this phase the mandate registry lives in **server memory**, not in an Algorand
smart contract. The blocker is honest and specific:

- Algorand TypeScript contracts need the **AlgoKit + puya** toolchain, which is
  not installed in this environment (`algokit` is not a recognised command).
- Deploying a contract requires a signing account. Putting a mnemonic on the
  server was ruled out, because MandateGuard must never hold private keys.

The x402 payment layer is **fully real** and unaffected. The proof layer is
labelled `IN_MEMORY` and `onChain: false` everywhere it appears — nothing
pretends to be blockchain data.

---

## Screenshots and proof

Captured evidence lives in [`demo-proof/`](demo-proof/) — real transcripts of the
rule engine, the 402 gate, the NVIDIA NIM calls and the failure paths, plus the
list of screenshots to take before a live demo.

Runbook: [`HACKATHON_DEMO.md`](HACKATHON_DEMO.md) · Judge answers:
[`JUDGE_QA.md`](JUDGE_QA.md)

## Known limitations

- **No smart contract is deployed.** Mandate proof and replay protection live in
  server memory, labelled `IN_MEMORY` / `onChain: false` everywhere they appear.
  Blocker: Algorand TypeScript needs the AlgoKit + puya toolchain (not installed
  here), and deploying would require a signing key on the server, which this
  project refuses to hold.
- **TestNet only.** MainNet is rejected by configuration, by design.
- **`@x402/*` is pinned to 2.12.0.** Version 2.21.0 truncates the Algorand
  network id to the 32-character CAIP-2 limit, which no longer matches what the
  GoPlausible facilitator advertises. Do not bump these without re-testing.
- **Automated tests never spend Test USDC.** Payment paths are exercised through
  the 402 gate and mocked units; a real payment is a manual step.
- **Demo catalog instead of a real marketplace.** The AI agent picks from three
  fixed items, not a live e-commerce API.
- **No real product is purchased.** The x402 payment is genuinely on-chain; the
  "buying an SSD" part is simulated.
- **NVIDIA NIM prepares the draft and the order — it never makes the security
  decision.** That is MandateGuard's job, in deterministic code.

## Security notes

- **TestNet only.** MainNet is rejected by configuration.
- The NVIDIA key and all secrets live only in `server/.env`, which is gitignored.
  The React app has no NVIDIA code and never receives a key.
- The browser only ever sees a **public** wallet address, shortened for display.
- Signing happens inside the wallet. The app never asks for a seed phrase,
  mnemonic or private key — if any site does, it is a scam.
- AI output is never trusted: types are validated, negative amounts and bad
  quantities are dropped, and price/seller/wallet in an AI order always come from
  the catalog, never from the model.
- If a payment fails, it fails. There is no fallback that marks it successful.

## Data lifetime

Everything is stored in **MySQL** and survives a restart: policies, verifications,
the audit log, the timeline, daily spend and the mandate registry. ID sequences
continue where they left off, so `MG-1001` is never handed out twice.

| Table | What it holds |
|---|---|
| `policies` | Human-approved spending policies |
| `mandates` | SHA-256 fingerprint, expiry, and whether it has been used |
| `verifications` | Every decision, its violations, payment proof and execution status |
| `flow_events` | The audit timeline, one row per step |
| `daily_spend` | Money counted as executed, per day |

The in-memory maps are only a read cache for the running process so the
deterministic engine can stay synchronous. MySQL is the source of truth.

**If MySQL is down** the server still starts, says so loudly in the log, reports
`storage.state: "IN_MEMORY"` in `/health`, and shows *"In memory (MySQL down)"* on
the Dashboard. It never pretends data was saved.

`Reset Demo` empties the tables as well as the in-memory cache. It cannot touch
Algorand — blockchain history is permanent.

---

## Project layout

```
mandateguard/
├── server/
│   └── src/
│       ├── services/
│       │   ├── mandateVerifier.ts   ⭐ the decision, plain TypeScript
│       │   ├── mandateProof.ts      SHA-256 hash + replay protection
│       │   ├── policyParser.ts      English → draft policy (NIM)
│       │   ├── aiOrderAgent.ts      catalog shopping agent (NIM)
│       │   └── nimClient.ts         NVIDIA client, key stays here
│       ├── x402/
│       │   ├── x402Config.ts        price, network, receiver
│       │   └── paymentMiddleware.ts payment gate + settlement reader
│       └── routes/
└── src/                             React frontend
    ├── services/x402Client.ts       402 → sign → retry
    └── components/WalletBar.tsx     connect wallet, balances
```
