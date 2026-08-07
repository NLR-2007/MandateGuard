interface Props {
  icon: string
  title: string
  text: string
}

export default function FeatureCard({ icon, title, text }: Props) {
  return (
    <div className="border border-[var(--rule)] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--indigo)]">
      <div className="text-3xl">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-[var(--ink)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">{text}</p>
    </div>
  )
}
