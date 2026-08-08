# NovaMart

A demonstration e-commerce shop, protected by [MandateGuard](../mandateguard).

NovaMart is a **separate application on purpose**. It sells things. It holds no
spending rules, no wallet and no policy logic. Before money moves it asks the
guard one question, the way a shop would ask a payment processor.

## The entire integration

[`src/api.ts`](src/api.ts) is the whole surface. The important part:

```ts
const verdict = await fetch(GUARD + '/api/verify-mandate', {
  method: 'POST',
  body: JSON.stringify({ policyId, order }),
}).then((r) => r.json())

if (verdict.decision !== 'APPROVED') return refuse(verdict.violations)
```

Delete that file and MandateGuard is gone; nothing else in the shop changes.
That is the point — a merchant should be able to adopt this in an afternoon.

## What the shop can and cannot do

- It **can** display the verdict, the broken rules and the transaction.
- It **cannot** overrule a refusal. A blocked order simply never shows a pay
  button, and the guard, not the shop, decides which is which.

## Running it

```bash
npm install
npm run dev          # http://localhost:5174
```

MandateGuard must be running on port 4021. Point elsewhere with
`VITE_GUARD_API` in a `.env` file.

## The live bar

The strip under the header shows what the AI shopper is doing right now —
browsing, choosing, being checked, blocked or paid — whether the instruction
came from this website or from Telegram. It polls `/api/agent/live`, a
read-only summary. The shop sees what the guard is doing, never how it decides.
