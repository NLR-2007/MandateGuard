// Telegram - the user's control channel.
//
// What this file is: a messenger. It carries news out and commands in.
//
// What it is NOT: a decision maker. An Approve tap here sends an order TO
// MandateGuard; it never approves a purchase. The engine still runs all ten
// rules and can still block an order the user personally approved. If Telegram
// could overrule the engine, this chat would become a spending key.
//
// Only ALLOWED_CHAT may command the agent. Anything from any other chat is
// ignored, because a bot username is public and guessable.

const API = 'https://api.telegram.org'

function token(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null
}

/** The one chat allowed to command this agent. */
function allowedChat(): string | null {
  return process.env.TELEGRAM_CHAT_ID?.trim() || null
}

export function isTelegramConfigured(): boolean {
  return Boolean(token() && allowedChat())
}

/** Safe summary for /health. Never returns the token. */
export function describeTelegram(): {
  enabled: boolean
  chatConfigured: boolean
  polling: boolean
} {
  return {
    enabled: Boolean(token()),
    chatConfigured: Boolean(allowedChat()),
    polling,
  }
}

export interface InlineButton {
  text: string
  /** Sent back to us when tapped. Carries the order id, so an old tap
      can never approve a new order. */
  callback_data: string
}

/**
 * Sends a message to the user's chat.
 *
 * Never throws: Telegram being unreachable must not break a purchase. The
 * worst case is the user does not get told, and the web UI still shows
 * everything.
 */
export async function sendMessage(
  text: string,
  buttons?: InlineButton[][],
): Promise<{ ok: boolean; messageId?: number }> {
  const t = token()
  const chat = allowedChat()
  if (!t || !chat) return { ok: false }

  try {
    const res = await fetch(`${API}/bot${t}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
      }),
    })

    const body = (await res.json()) as { ok: boolean; result?: { message_id: number } }
    if (!body.ok) console.error('  ✕ Telegram send failed')
    return { ok: body.ok, messageId: body.result?.message_id }
  } catch (error) {
    console.error(`  ✕ Telegram unreachable: ${(error as Error).message}`)
    return { ok: false }
  }
}

/** Replaces the buttons under a message, so an answered question cannot be
    answered twice. */
export async function editButtons(
  messageId: number,
  buttons: InlineButton[][] = [],
): Promise<void> {
  const t = token()
  const chat = allowedChat()
  if (!t || !chat) return

  try {
    await fetch(`${API}/bot${t}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        message_id: messageId,
        reply_markup: { inline_keyboard: buttons },
      }),
    })
  } catch {
    /* cosmetic only */
  }
}

/** Clears the small spinner on a tapped button. */
export async function answerCallback(callbackId: string, text?: string): Promise<void> {
  const t = token()
  if (!t) return
  try {
    await fetch(`${API}/bot${t}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId, text: text ?? '' }),
    })
  } catch {
    /* cosmetic only */
  }
}

// ── Receiving ─────────────────────────────────────────────

export interface Incoming {
  /** A typed command such as /status, lowercased, without arguments. */
  command?: string
  /** Raw text of a plain message. */
  text?: string
  /** callback_data from a tapped button. */
  callback?: string
  callbackId?: string
  messageId?: number
}

type Handler = (msg: Incoming) => Promise<void> | void

let polling = false
let offset = 0

/**
 * Long-polls Telegram for new messages.
 *
 * Polling rather than webhooks on purpose: it needs no public URL, no tunnel
 * and no inbound firewall rule, so it works on a laptop on venue wi-fi.
 */
export function startPolling(handler: Handler): void {
  if (polling || !isTelegramConfigured()) return
  polling = true

  const loop = async () => {
    while (polling) {
      try {
        const t = token()
        const url = new URL(`${API}/bot${t}/getUpdates`)
        url.searchParams.set('timeout', '30')
        url.searchParams.set('offset', String(offset))
        url.searchParams.set('allowed_updates', '["message","callback_query"]')

        const res = await fetch(url)
        const body = (await res.json()) as {
          ok: boolean
          error_code?: number
          description?: string
          result?: TelegramUpdate[]
        }

        if (!body.ok) {
          /**
           * 409 means another process is polling the same bot. Telegram hands
           * each update to whichever poller asks first, so messages appear to
           * vanish. Saying so loudly matters - this used to fail in silence.
           */
          if (body.error_code === 409) {
            console.error(
              '  ✕ Telegram: another instance is polling this bot. Stop the other server — commands will be missed until you do.',
            )
          } else {
            console.error(`  ✕ Telegram getUpdates failed: ${body.description}`)
          }
          await new Promise((r) => setTimeout(r, 3000))
          continue
        }

        for (const update of body.result ?? []) {
          offset = update.update_id + 1
          const incoming = parseUpdate(update)
          if (incoming) {
            console.log(`  📩 Telegram: ${incoming.command ?? incoming.callback ?? 'message'}`)
            await handler(incoming)
          }
        }
      } catch (error) {
        console.error(`  ✕ Telegram poll error: ${(error as Error).message}`)
        // Network blip. Wait a moment rather than spinning hot.
        await new Promise((r) => setTimeout(r, 3000))
      }
    }
  }

  void loop()
  console.log('  ✓ Telegram: listening for commands')
}

export function stopPolling(): void {
  polling = false
}

interface TelegramUpdate {
  update_id: number
  message?: { chat: { id: number }; text?: string; message_id: number }
  callback_query?: {
    id: string
    data?: string
    message?: { chat: { id: number }; message_id: number }
  }
}

/** Turns a raw update into our shape, dropping anything from another chat. */
function parseUpdate(update: TelegramUpdate): Incoming | null {
  const allowed = allowedChat()

  if (update.callback_query) {
    const chatId = String(update.callback_query.message?.chat.id ?? '')
    if (chatId !== allowed) return null
    return {
      callback: update.callback_query.data,
      callbackId: update.callback_query.id,
      messageId: update.callback_query.message?.message_id,
    }
  }

  if (update.message) {
    const chatId = String(update.message.chat.id)
    if (chatId !== allowed) {
      console.warn(`  ⚠ Telegram message from a chat that is not allowed: ${chatId}`)
      return null
    }
    const text = update.message.text?.trim() ?? ''
    return {
      text,
      command: text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : undefined,
      messageId: update.message.message_id,
    }
  }

  return null
}
