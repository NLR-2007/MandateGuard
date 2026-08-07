export type BadgeTone =
  | 'ai'
  | 'human'
  | 'order'
  | 'verified'
  | 'simulation'
  | 'blocked'
  | 'neutral'

const tones: Record<BadgeTone, string> = {
  ai: 'border-violet-500/50 bg-violet-500/10 text-violet-300',
  human: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
  order: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300',
  verified: 'border-blue-500/50 bg-blue-500/10 text-blue-300',
  simulation: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300',
  blocked: 'border-red-500/50 bg-red-500/10 text-red-400',
  neutral: 'border-slate-700 bg-slate-800/60 text-slate-300',
}

interface Props {
  tone?: BadgeTone
  children: React.ReactNode
}

/** Small label that shows WHO did a step: the AI, the human, or the engine. */
export default function Badge({ tone = 'neutral', children }: Props) {
  return (
    <span
      className={[
        'inline-block rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap',
        tones[tone],
      ].join(' ')}
    >
      {children}
    </span>
  )
}
