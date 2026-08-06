import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing relative min-h-[calc(100dvh-80px)] flex flex-col items-center justify-center px-4 py-10 overflow-x-clip">
      {children}
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-100 opacity-70"
        style={{ color: 'var(--mk-text-subtle)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to home
      </Link>
    </div>
  )
}
