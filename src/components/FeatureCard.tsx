interface Props {
  icon: string
  title: string
  text: string
}

export default function FeatureCard({ icon, title, text }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/50">
      <div className="text-3xl">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-400">{text}</p>
    </div>
  )
}
