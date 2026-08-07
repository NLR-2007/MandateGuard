// Phase 7 - ties the whole journey together.
//
// One request id (REQ-XXXX) links: instruction -> draft -> policy -> AI order
// -> x402 payment -> verification -> execution -> audit.
//
// This file only records events. It never makes a decision.

export interface FlowEvent {
  requestId: string
  at: string
  step: string
  detail: string
}

const events: FlowEvent[] = []

let requestCounter = 1000

/** REQ-XXXX. Contains no personal or sensitive information. */
export function nextRequestId(): string {
  requestCounter += 1
  return `REQ-${requestCounter}`
}

/** Adds one line to the timeline, with a real timestamp. */
export function addEvent(requestId: string, step: string, detail = ''): FlowEvent {
  const event: FlowEvent = {
    requestId,
    at: new Date().toISOString(),
    step,
    detail,
  }
  events.push(event)
  return event
}

/** Oldest first, so the timeline reads top to bottom. */
export function getTimeline(requestId: string): FlowEvent[] {
  return events.filter((e) => e.requestId === requestId)
}

export function getAllEvents(): FlowEvent[] {
  return events
}

export function resetEvents(): void {
  events.length = 0
}
