import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-section-dark landing-hero-pattern relative min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4 py-10 overflow-hidden">
      {children}
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to home
      </Link>
    </div>
  )
}
