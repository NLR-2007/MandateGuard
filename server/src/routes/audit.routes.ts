import { Hono } from 'hono'
import { getSpentToday } from '../data/memoryStore.js'
import { listAudit, recordExecution } from '../services/auditService.js'
import { getTimeline } from '../services/flowService.js'

export const auditRoutes = new Hono()

/** GET /api/audit - every verification, newest first */
auditRoutes.get('/audit', (c) => {
  return c.json({
    success: true,
    spentToday: getSpentToday(),
    entries: listAudit(),
  })
})

/**
 * POST /api/executions - mark an approved verification as executed.
 * SIMULATION ONLY. No real payment occurs.
 */
auditRoutes.post('/executions', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: 'Body must be valid JSON.' }, 400)
  }

  const verificationId = (body as Record<string, unknown>)?.verificationId

  if (typeof verificationId !== 'string' || verificationId.trim() === '') {
    return c.json({ success: false, error: 'Verification ID is required.' }, 400)
  }

  const outcome = recordExecution(verificationId)

  if (!outcome.ok) {
    const status = outcome.status === 404 ? 404 : outcome.status === 409 ? 409 : 400
    return c.json(
      {
        success: false,
        error: outcome.error,
        alreadyExecuted: outcome.alreadyExecuted ?? false,
        entry: outcome.entry ?? null,
      },
      status,
    )
  }

  console.log(`  ⚑ ${verificationId} marked SIMULATED_EXECUTED`)

  return c.json({
    success: true,
    note: 'No real payment occurred. This is a simulated execution.',
    entry: outcome.entry,
    spentToday: outcome.spentToday,
    mandateStatus: outcome.mandateStatus,
  })
})

/** GET /api/audit/:verificationId - one full record for the detail page. */
auditRoutes.get('/audit/:verificationId', (c) => {
  const entry = listAudit().find((e) => e.verificationId === c.req.param('verificationId'))

  if (!entry) {
    return c.json({ success: false, error: 'Verification not found.' }, 404)
  }

  return c.json({
    success: true,
    entry,
    timeline: getTimeline(entry.requestId ?? ''),
  })
})
