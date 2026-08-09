import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Geist, Geist_Mono, Libre_Caslon_Display, Playfair_Display } from 'next/font/google'
import { PwaRegister } from '@/components/pwa/PwaRegister'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
// The logo wordmark keeps its original face (user-pinned): Playfair is
// loaded for the YOUR/MAJOR lockup only, never for headings.
const playfairLogo = Playfair_Display({
  variable: '--font-logo',
  weight: ['400', '900'],
  subsets: ['latin'],
  display: 'swap',
})
// The one display face, marketing and app both: globals.css points
// --font-heading at this variable. See DESIGN.md "Operate Surface".
const libreCaslon = Libre_Caslon_Display({
  variable: '--font-display',
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#041e0f',
  width: 'device-width',
  initialScale: 1,
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Theme rides a cookie so SSR paints the right mode with no flash.
  const theme = (await cookies()).get('ym-theme')?.value === 'dark' ? 'dark' : ''
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${libreCaslon.variable} ${playfairLogo.variable} ${theme} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <PwaRegister />
        <InstallPrompt />
      </body>
    </html>
  )
}
