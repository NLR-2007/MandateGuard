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

### Why does this need a blockchain at all?

**Because an audit log you control proves nothing.** MandateGuard's whole claim
is "this purchase matched what the human approved." If the approved policy lives
only in our database, we could edit it after the fact and the audit log would
still look perfect. That is not proof, it is a promise.

So the policy's SHA-256 fingerprint is written onto Algorand TestNet as a
transaction note. Change one character of the policy and the fingerprint changes,
and the chain no longer agrees. Nobody has to trust us — including us.

x402 on Algorand is the second reason: an AI agent can pay a per-call fee
autonomously, in stablecoin, with no card and no human in the loop.

### Why is the smart contract not deployed?

**We chose not to fake it.** Anchoring uses the transaction note field, which is
real on-chain data — but not on-chain application state. A contract would let the
chain itself reject a replayed mandate; today the server enforces that against
MySQL. Deploying one needs the AlgoKit + puya toolchain and a signing key on the
server, which this project refuses to hold. `onChain` is `true` only after a
fingerprint has actually been written and read back.

### How do I know you did not just make up that transaction id?

**Read it back yourself.** `GET /api/mandates/:id/anchor` re-reads the
transaction from a public Algorand indexer every single time — nothing is served
from cache. The server refuses a transaction id whose note does not match the
fingerprint it computed itself, so an id alone proves nothing here. Open the
explorer link and check the note by hand:

```bash
node demo-proof/verify-anchor.mjs MG-1001
```

### What would you build next?

1. Deploy the mandate proof contract so the chain itself rejects a replayed
   mandate, instead of the server doing it.
2. A database, so the audit log survives a restart.
3. Real merchant integrations instead of the demo catalog.
4. Policy templates and multi-agent budgets.

### What is the one thing to remember?

> **x402 verifies payment. MandateGuard verifies intent. Algorand provides
> proof.**
