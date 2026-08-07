# MandateGuard — Answers for Judges

Short answers. Say the first line; the rest is only if they dig.

---

### Why do we need MandateGuard?

**Amount limits only control how much an AI spends. MandateGuard also checks what
the AI is buying.**

Our demo order is ₹4,900 against a ₹5,000 limit — perfectly within budget — but
it has the wrong quantity, wrong shop, an unrequested warranty and an unknown
payment wallet. An amount-only control waves that through.

### Why x402?

**x402 lets the AI or the application pay for the verification API directly over
HTTP.** No signup, no API keys, no monthly plan. The agent hits the endpoint, gets
a 402 with a machine-readable price, pays, and retries. That is what makes
per-call security affordable for autonomous agents.

### Why Algorand?

**Algorand records and confirms the x402 TestNet payment.** Fast finality, tiny
fees, and the facilitator sponsors the transaction fee so the payer only needs
the USDC. Every verification we sell leaves a public, checkable receipt.

### Why NVIDIA NIM?

**NVIDIA NIM converts normal human instructions into structured policy data.**
A person types one sentence instead of filling nine fields. That is the only job
it has.

### Does the AI approve the payment?

**No. MandateGuard uses deterministic rules for the final Approved or Blocked
decision.** It is ordinary TypeScript — ten `if` checks in
`server/src/services/mandateVerifier.ts`. No model, no randomness, no network
call takes part. We have a unit test asserting that identical input produces
byte-identical output.

### What stops the AI from lying in the order?

**Price, seller and receiver wallet always come from the catalog, never from the
model.** There is a test where the model tries to send `price: 1`,
`seller: EvilStore`, `receiverWallet: ALGO-ATTACKER` — all three are discarded.

### Is MandateGuard replacing x402?

**No. They solve different problems. x402 handles payment. MandateGuard handles
spending-policy verification.** You can pay correctly and still be blocked — the
UI shows those as two separate answers on purpose.

### Is this a real purchase?

**The hackathon uses a demo shopping catalog and a real TestNet x402 payment. The
final product purchase is simulated.** The payment is genuinely on-chain; the
"buying an SSD" part is a stand-in for a real merchant integration.

### How do you stop the same approval being used twice?

**Each policy gets a SHA-256 fingerprint, and a mandate can only be executed
once.** After execution it turns `USED` and any further attempt is refused with
*"Mandate has already been used."* Paying the verification fee does **not**
consume a mandate — only recording an approved execution does.

### What if the AI service goes down?

**Nothing security-related depends on it.** Manual policy creation still works,
and MandateGuard still decides. We tested this by pointing the config at a
non-existent model: the UI showed a plain message and the engine kept blocking
unsafe orders correctly.

### What if the payment facilitator goes down?

**The paid route answers 503 and the protected handler does not run — nothing is
faked.** We found and fixed a real bug here during final testing: a facilitator
outage used to crash the whole backend. It no longer does.

### Why is the smart contract not deployed?

**We chose not to fake it.** Algorand TypeScript needs the AlgoKit + puya
toolchain, and deploying would require a signing key on the server — which this
project refuses to hold. So mandate proof is a real SHA-256 hash stored
server-side, labelled `onChain: false` everywhere it appears. The x402 payment
layer is fully real and unaffected.

### What would you build next?

1. Deploy the mandate proof contract so replay protection is on-chain.
2. A database, so the audit log survives a restart.
3. Real merchant integrations instead of the demo catalog.
4. Policy templates and multi-agent budgets.

### What is the one thing to remember?

> **x402 verifies payment. MandateGuard verifies intent. Algorand provides
> proof.**
