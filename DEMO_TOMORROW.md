# Demo runbook — the agent that shops

**Round: 10:10 AM.** Read this once before you walk in.

---

## Before you start (5 minutes)

```powershell
# 1. one backend only
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like "*src/index.ts*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

cd D:\Block-Chain\mandateguard\server; npm start
# wait for:  Storage: MySQL   /   ✓ Telegram: listening   /   x402: ON

#    Use `npm start`, NOT `npm run dev`. The watcher restarts on every file
#    change and each restart leaves another Telegram poller behind. Two
#    pollers fight over the same bot and your commands go unanswered.

# 2. frontend
cd D:\Block-Chain\mandateguard; npm run dev
```

**Check on your phone:** send `/status` to `@Mandateguardnlr_bot`. If it answers, everything is up.

**Open these tabs:**

1. `http://localhost:5173/` — the landing page
2. `http://localhost:5173/shop`
3. Telegram, **mirrored to the projector if you can**. This is the demo.

---

## The one sentence

> **You approve the rule once. The agent shops on its own. MandateGuard decides what it is allowed to buy — and your phone tells you everything.**

---

## STEP 1 — The problem (30 seconds)

> *"AI agents can now spend money on their own. The question nobody has answered is: what stops one from buying the wrong thing?"*

Landing page on screen. Don't linger.

---

## STEP 2 — The human sets one rule (60 seconds)

Go to **Dashboard**. Read the instruction aloud, click **Ask AI to Understand**.

> *"NVIDIA NIM reads plain English and fills the form. Notice what it left empty — I never said when this expires, so it did not guess."*

Fill it, click **Approve**.

**Your phone buzzes.** Show it.

> *"That is the rule. I approved it once. I will not be approving anything again."*

---

## STEP 3 — Put the rule on Algorand (45 seconds)

Click **Write proof to Algorand** → sign in Pera.

> *"My audit log is only as honest as my database, and I own my database. This is the fingerprint of the rule, on a public ledger. If I quietly change the rule later, the chain stops agreeing with me. You do not have to trust me."*

Phone buzzes again with the explorer link. Tap **Check the chain again** to show it re-reading live.

---

## STEP 4 — The agent shops, and is stopped ⭐ THE MOMENT

Go to **Shop**. Set mode to **Autonomous**. Click **Send the agent shopping**.

Watch the ten rules tick through on screen.

If it is blocked — **let the phone do the talking**:

> 🛑 *Stopped an order.* Your agent tried to buy … Refused for 4 reasons …

> *"Nobody approved that. Nobody rejected it. I was not even asked — I was told. The agent tried something outside my rule and the engine stopped it before any money moved. That is the product."*

---

## STEP 5 — It buys something, for real (60 seconds)

Switch to **Ask me first**. Send the agent shopping again.

Phone shows **Approve / Reject**. **Tap Approve on the projector.** The web page continues on its own.

> *"Notice the page did not ask me. My phone did. And approving here does not buy anything — it only lets the order reach MandateGuard, which had already passed it."*

Click **Pay SecureStore 0.48 USDC** → sign in Pera.

Receipt appears. Phone gets the full receipt with the explorer link. **Open the link.**

> *"That is real test USDC, on Algorand, in the seller's own wallet. Not a simulation."*

---

## STEP 5b — The same thing, entirely from your phone ⭐

Put Telegram on the projector. Send **`/buy`**.

Two buttons appear: **💾 An SSD** and **💻 A gaming laptop**.

**Tap the laptop first.**

> 🛑 Stopped an order — Gaming Laptop, ₹85,000, OtherStore. Refused for 6 reasons.

> *"I asked for a laptop. The agent genuinely went and found one — it did not
> quietly swap in something safe. MandateGuard refused it six different ways,
> and no money moved. No browser is open. This is all from my phone."*

**Now tap `/buy` again → An SSD.**

> 🛒 Should I buy this? · 1TB SSD · ₹4,800 → 0.48 test USDC · SecureStore
> ✅ MandateGuard checked it — all 10 rules passed.
> [✅ Yes, buy it] [⏸ No, wait]

Tap **Yes, buy it**. The receipt arrives with a live explorer link. Open it.

> *"The agent paid from its own wallet. I never signed anything. Same engine
> refused the laptop and allowed this — that is the whole product."*

---

## STEP 6 — The kill switch (20 seconds)

On your phone, send **`/stop`**.

> ⛔ Spending frozen. Every new order will now be refused by rule 1.

Send the agent shopping again — it is blocked immediately.

> *"One word from my phone and the agent cannot spend anything. And notice how: it did not add a special case. It disabled the policy, and rule 1 — the same rule that runs on every order — refuses it."*

Then `/resume`.

---

## STEP 7 — Close (20 seconds)

Send `/spend` and `/status` on the projector.

> **"x402 verifies payment. MandateGuard verifies intent. Algorand provides proof. Telegram gives the human control."**

---

## Judge questions

**"Does the AI make the decision?"**
No. NIM drafts the policy and picks a product. The decision is plain TypeScript — ten rules, 73 unit tests. Show `mandateVerifier.ts`.

**"Why do you need a blockchain?"**
An audit log I control proves nothing. The rule's fingerprint is on Algorand — change the rule and the chain disagrees. Also: the agent pays per call in stablecoin with no card and no human.

**"Did it really pay?"**
Two separate payments, both real: 0.005 USDC to run the check, and the product price to the seller's wallet. Open the explorer.

**"Could someone else control your bot?"**
Only my chat id is allowlisted. Anything from any other chat is dropped.

**"If your Telegram is hacked, can they spend your money?"**
No. An Approve tap only lets an order reach MandateGuard. The engine still runs all ten rules and can still refuse it. Telegram is never a spending key.

**"Is the shop real?"**
No — a fixed catalogue of 12 items, and I say so. The seller wallets are real TestNet accounts, and the money really arrives.

**"What is not built?"**
No smart contract — anchoring uses the transaction note field, so replay protection is enforced by the server, not the chain. No real merchant. Order tracking beyond payment is not built. TestNet only.

---

## If something breaks

| Problem | Do this |
|---|---|
| Telegram silent | Keep going — the web UI shows everything. Say "my phone is on the venue wifi." |
| AI request hangs | NVIDIA's endpoint is congested. Times out in 90s with a readable message; use the Dashboard's manual path. If it is slow every time, the 70B models are down — check `NVIDIA_MODEL` in `server/.env` is `meta/llama-3.1-8b-instruct`. |
| Wallet will not connect | Wallet bar is at the top of Dashboard and Shop. Hard-refresh. |
| Facilitator down | Paid routes answer 503 and say so. Nothing fakes success. |
| Backend died | The port-conflict command at the top of this file. |
| **Everything is broken** | `demo-proof/05-real-run.txt` has real transaction ids. Open the explorer links. |

**Rehearse steps 4, 5 and 6 at least twice.** Those three are the demo.
