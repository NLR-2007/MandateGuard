# MandateGuard — Hackathon Runbook

**Target time: 4–5 minutes.** Follow the order below. Say the bold line, do the
indented action.

---

## Before you walk on stage (5 minutes)

```bash
# Terminal 1
cd mandateguard/server && npm run dev      # http://localhost:4021

# Terminal 2
cd mandateguard && npm run dev             # http://localhost:5173
```

**Checklist**

- [ ] **XAMPP MySQL is running** (backend banner must say `Storage: MySQL`)
- [ ] Backend banner shows `x402: ON` and `NVIDIA NIM: configured`
- [ ] Browser open at `http://localhost:5173`, hard-refreshed (Ctrl+Shift+R)
- [ ] Pera Wallet open, on **TestNet**, with ≥ 1 ALGO and ≥ 0.05 Test USDC
- [ ] Wallet already connected in the app (do this *before* the demo)
- [ ] `demo-proof/` folder open in a second tab, in case Wi-Fi dies
- [ ] Nav toggle set to **Demo** (you want the Problem Demo page visible)

---

## STEP 1 — The problem (45 seconds)

> **"AI shopping is growing. But an amount limit alone does not guarantee that
> the AI buys exactly what the human approved."**

- Open **Problem Demo** in the nav.
- Point at the numbers: **₹4,900 < ₹5,000 → PASS**.

> **"The amount is fine. But look what else changed."**

- Point at the four red rows: quantity 1→2, seller, warranty, receiver wallet.
- Read the big line out loud: **"Amount approved ≠ Intent approved."**

---

## STEP 2 — The idea (15 seconds)

> **"That gap is why we built MandateGuard. It checks not just how much the AI
> spends, but what it is actually buying."**

---

## STEP 3 — Human writes a rule in plain English (45 seconds)

- Click **Dashboard** → **Start AI Purchase**.
- The instruction box is pre-filled. Read it aloud:

> *"Buy one 1TB SSD below ₹5000 from SecureStore. Do not add warranty. Only pay
> ALGO-SECURE-STORE. Maximum ₹5000 per transaction. Daily limit ₹10000."*

- Click **Ask AI to Understand**.

> **"NVIDIA NIM reads that sentence and fills in the form."**

- Point at the filled fields. If Expiry is red:

> **"Notice it left this empty. I never said when it expires, so it did not
> guess. The AI never invents a value the human did not state."**

- Fill the expiry → click **✓ Approve Human Policy**.

> **"Nothing was real until I clicked that. The AI cannot create a policy."**

- Point at the new **MG-XXXX** id and the **Human Approved** badge.

---

## STEP 4 — The AI goes shopping (20 seconds)

- Keep the scenario switch on **Safe AI Order**.
- Click **✨ Ask AI to Prepare Order**.

> **"The AI picked an item. And we treat it as untrusted — read the yellow line."**

- Point at: *"AI order is untrusted until MandateGuard verifies it."*

---

## STEP 5 — Pay with x402 on Algorand (60 seconds)

- Click **⛓️ Verify with x402 + MandateGuard**.

> **"The verification service is not free. It answers HTTP 402 Payment
> Required — the price tag a machine can read."**

- Point at the stage list as it moves. When the wallet pops up:

> **"0.005 Test USDC on Algorand TestNet. I approve it myself — the app never
> holds my keys."**

- **Sign in Pera.** If the notification never reaches your phone, wait ~6 seconds
  and click **↻ Resend request to wallet** — then reject any older prompt still
  open on the phone and approve the newest one.
- When the result appears, point at the two boxes:

> **"x402 Payment: VERIFIED. MandateGuard: APPROVED."**

- Click **View x402 Payment on Algorand Explorer** and show the real transaction.

---

## STEP 6 — The attack (60 seconds) ⭐ the moment that wins it

- Click **↺ Reset Demo**, then **Start AI Purchase** again.
- Repeat step 3 quickly (instruction → Approve).
- Switch the scenario to **Unsafe AI Order** → **⚠️ Load Unsafe AI Order**.

> **"Same human rule. But this AI order has 2 SSDs, a different shop, a warranty
> nobody asked for, and an unknown wallet — for ₹4,900. Still under the limit."**

- Click **⛓️ Verify with x402 + MandateGuard** → sign in Pera again.

> **"The payment succeeds. Watch what MandateGuard does."**

- Point at the two boxes: **x402 VERIFIED** ✓ and **MandateGuard BLOCKED** ✕.
- Read the yellow line: *"Payment for verification succeeded. The unsafe AI
  purchase was blocked."*
- Point at the four reasons.

---

## STEP 7 — Close (20 seconds)

> **"x402 verifies payment. MandateGuard verifies intent. Algorand provides the
> proof."**

- Open **History**: both runs are there, with decisions, violations, the real
  Algorand transaction and the mandate status.

> **"Every decision is auditable, and it was made by plain code — not by the AI."**

---

## If something breaks on stage

| Problem | What to do, out loud |
|---|---|
| **Phone notification missed** | Wait ~6 seconds, then click **↻ Resend request to wallet**. It sends a fresh signing request. |
| Wallet won't connect | *"Let me show you the recorded proof"* → open `demo-proof/` |
| Payment hangs / facilitator down | Use the **free route** button on the AI Order page — the same engine, no payment layer. Say: *"The payment layer is optional for the security decision."* |
| NVIDIA slow or failing | Switch to **Create Policy → Manual Policy** tab. Say: *"AI is assistance only. The security engine does not depend on it."* |
| MySQL not started | Backend still runs but says `Storage: IN-MEMORY`. Start MySQL in XAMPP and restart the backend — nothing else changes. |
| Whole demo fails | Talk over the screenshots in `demo-proof/`. Nothing is faked, all of it is real captured output. |

The backend now survives a facilitator outage, so a bad network never takes the
whole app down.

---

## The one-sentence pitch

> **MandateGuard is the layer that checks an AI agent's final purchase against
> the rules a human actually approved — before any money moves.**
