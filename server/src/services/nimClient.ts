// NVIDIA NIM client - Phase 5
//
// The API key lives only here, on the backend. It is never sent to the
// browser, never logged, and never returned in any API response.
//
// NIM is used ONLY to read English and produce structured JSON.
// It never decides APPROVED or BLOCKED - that stays in mandateVerifier.ts.

import OpenAI from 'openai'

export interface NimConfig {
  apiKey: string
  baseURL: string
  model: string
}

export class NimConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NimConfigError'
  }
}

/** True when every required variable is present. Safe to expose. */
export function isNimConfigured(): boolean {
  return Boolean(
    process.env.NVIDIA_API_KEY?.trim() &&
      process.env.NVIDIA_BASE_URL?.trim() &&
      process.env.NVIDIA_MODEL?.trim(),
  )
}

/** The model name only - never the key. Safe to show in the UI. */
export function getModelName(): string | null {
  return process.env.NVIDIA_MODEL?.trim() || null
}

function readConfig(): NimConfig {
  const apiKey = process.env.NVIDIA_API_KEY?.trim()
  const baseURL = process.env.NVIDIA_BASE_URL?.trim()
  const model = process.env.NVIDIA_MODEL?.trim()

  if (!apiKey) {
    throw new NimConfigError('NVIDIA_API_KEY is not set in server/.env')
  }
  if (!baseURL) {
    throw new NimConfigError('NVIDIA_BASE_URL is not set in server/.env')
  }
  // No silent fallback model on purpose.
  if (!model) {
    throw new NimConfigError('NVIDIA_MODEL is not set in server/.env')
  }

  return { apiKey, baseURL, model }
}

let cached: OpenAI | null = null

function getClient(): OpenAI {
  if (!cached) {
    const { apiKey, baseURL } = readConfig()
    // Large models can be slow on a cold start, so allow generous time.
    cached = new OpenAI({ apiKey, baseURL, timeout: 90_000, maxRetries: 1 })
  }
  return cached
}

/** A single chat turn. Tests replace this function instead of calling NVIDIA. */
export type CompleteFn = (
  systemPrompt: string,
  userPrompt: string,
  maxTokens?: number,
) => Promise<string>

/**
 * Sends one short prompt to NVIDIA NIM and returns the raw text reply.
 * Low temperature and a small token budget keep answers stable and cheap.
 */
export const completeWithNim: CompleteFn = async (
  systemPrompt,
  userPrompt,
  maxTokens = 400,
) => {
  const { model } = readConfig()
  const client = getClient()

  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  const text = response.choices?.[0]?.message?.content
  if (!text || text.trim() === '') {
    throw new Error('NVIDIA NIM returned an empty response.')
  }
  return text
}

/** Turns any NIM/network failure into a short, safe, user-facing sentence. */
export function describeNimError(error: unknown): string {
  if (error instanceof NimConfigError) {
    return `AI is not configured: ${error.message}`
  }

  const err = error as { status?: number; code?: string; message?: string }

  if (err?.status === 401 || err?.status === 403) {
    return 'AI service rejected the API key. Check NVIDIA_API_KEY in server/.env.'
  }
  if (err?.status === 404) {
    return 'The configured NVIDIA model was not found. Check NVIDIA_MODEL in server/.env.'
  }
  if (err?.status === 429) {
    return 'AI service is rate limited right now. Please try again in a moment.'
  }
  if (err?.code === 'ETIMEDOUT' || /timeout/i.test(err?.message ?? '')) {
    return 'AI service timed out. You can still create the policy manually.'
  }
  if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') {
    return 'Cannot reach the AI service. You can still create the policy manually.'
  }
  if ((err?.status ?? 0) >= 500) {
    return 'AI service is temporarily unavailable. You can still create the policy manually.'
  }

  return 'AI service is temporarily unavailable. You can still create the policy manually.'
}

/**
 * Pulls a JSON object out of a model reply.
 * Models sometimes wrap JSON in ```json fences or add a sentence around it.
 */
export function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    // Fall back to the first {...} block in the reply.
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('AI did not return valid JSON.')
    }
    try {
      return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      throw new Error('AI did not return valid JSON.')
    }
  }
}
