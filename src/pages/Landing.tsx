import React, { Suspense } from 'react'
import { Link } from 'react-router-dom'

// Loaded on demand: the 3D scene is large, and the page must be readable
// long before it arrives.
const Spline = React.lazy(() => import('@splinetool/react-spline'))

const SCENE = 'https://prod.spline.design/Slk6b8kz3LRlKiyk/scene.splinecode'

/**
 * The front door.
 *
 * Rendered full-bleed, outside the paper-themed chrome the rest of the app
 * uses - see App.tsx. The 3D background is decoration only: every word and
 * every button works if it never loads, which matters on venue wi-fi.
 */
export default function Landing() {
  return (
    <div className="lp relative overflow-hidden">
      {/* 3D background */}
      <div className="absolute inset-0">
        <Suspense fallback={null}>
          <Spline scene={SCENE} className="h-full w-full" />
        </Suspense>
      </div>

      {/* Darkens the scene so the text stays readable over any frame of it. */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(to top, hsl(0 0% 8% / 0.92) 0%, hsl(0 0% 8% / 0.55) 45%, hsl(0 0% 8% / 0.25) 100%)',
        }}
      />

      {/* Masthead */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-5 md:px-12">
        <span className="text-[19px] font-semibold tracking-tight">
          MANDATE<span style={{ color: 'var(--lp-accent)' }}>GUARD</span>
        </span>

        <Link to="/dashboard" className="lp-btn lp-btn-ghost pointer-events-auto">
          Open the app
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 flex min-h-screen items-end">
        <div className="pointer-events-none w-full max-w-[46rem] px-6 pt-32 pb-14 md:px-12 md:pb-16">
          <h1
            className="lp-rise mb-3 text-[clamp(2.75rem,8vw,5.5rem)] leading-[1.03] font-bold tracking-[-0.05em] uppercase"
            style={{ animationDelay: '0.15s' }}
          >
            Mandate<span style={{ color: 'var(--lp-accent)' }}>Guard</span>
          </h1>

          <p
            className="lp-rise mb-4 text-[clamp(1.15rem,2.5vw,1.75rem)] leading-snug font-light md:mb-5"
            style={{ animationDelay: '0.32s' }}
          >
            AI agents can spend your money.
            <br />
            This decides what they are allowed to buy.
          </p>

          <p
            className="lp-rise mb-7 max-w-[38rem] text-[clamp(0.9rem,1.4vw,1.05rem)] leading-relaxed font-light"
            style={{ animationDelay: '0.46s', color: 'var(--lp-muted)' }}
          >
            You approve a rule in plain English. The agent goes shopping. Before a
            single rupee moves, ten deterministic checks compare the order against
            exactly what you approved — no AI anywhere in that decision. The rule
            itself is fingerprinted onto Algorand, so it cannot be quietly rewritten
            afterwards. Not even by us.
          </p>

          <div
            className="lp-rise flex flex-wrap gap-3"
            style={{ animationDelay: '0.6s' }}
          >
            <Link to="/dashboard" className="lp-btn lp-btn-accent pointer-events-auto">
              Run it yourself
            </Link>
            <Link to="/unsafe-demo" className="lp-btn lp-btn-plain pointer-events-auto">
              See what goes wrong without it
            </Link>
          </div>

          <p
            className="lp-rise mt-6 text-[12px] font-light"
            style={{ animationDelay: '0.74s', color: 'hsl(0 0% 60% / 0.75)' }}
          >
            x402 payments · Algorand TestNet · NVIDIA NIM · test funds only, never MainNet
          </p>
        </div>
      </section>
    </div>
  )
}
