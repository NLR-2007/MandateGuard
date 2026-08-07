export type BadgeTone =
  | 'ai' | 'human' | 'order' | 'verified' | 'simulation' | 'blocked' | 'neutral'
const tones: Record<BadgeTone, string> = {
  ai: 'tag-indigo',
  human: 'tag-green',
  order: 'tag-ink',
  verified: 'tag-indigo',
  simulation: 'tag-ochre',
  blocked: 'tag-red',
  neutral: 'tag-ink',
}

interface Props {
  tone?: BadgeTone
  children: React.ReactNode
}

/** A classification mark: who performed a step, or how a record is filed. */
export default function Badge({ tone = 'neutral', children }: Props) {
  return <span className={`tag ${tones[tone]}`}>{children}</span>
}
