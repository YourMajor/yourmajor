import Link from 'next/link'

export function Footer() {
  return (
    <footer className="footer-masters">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-center gap-4 text-xs">
        <Link href="/terms" className="text-white/60 hover:text-white transition-colors">
          Terms of Use
        </Link>
        <Link href="/privacy" className="text-white/60 hover:text-white transition-colors">
          Privacy Policy
        </Link>
        <Link href="/feedback" className="text-white/60 hover:text-white transition-colors">
          Feedback
        </Link>
      </div>
    </footer>
  )
}
