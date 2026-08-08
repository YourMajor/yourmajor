import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Playfair_Display, Libre_Caslon_Display } from 'next/font/google'
import { PwaRegister } from '@/components/pwa/PwaRegister'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const playfair = Playfair_Display({
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
})
// Marketing surface display face. Scoped to `.marketing` in globals.css;
// the application keeps --font-heading. See DESIGN.md.
const libreCaslon = Libre_Caslon_Display({
  variable: '--font-display',
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#1A3260',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'YourMajor',
  description: 'Live tournament scoring, leaderboards, and more.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'YourMajor',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${libreCaslon.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <PwaRegister />
        <InstallPrompt />
      </body>
    </html>
  )
}
