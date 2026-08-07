import { GlobalNav } from '@/components/GlobalNav'
import { Footer } from '@/components/Footer'
import { BottomTabBar } from '@/components/BottomTabBar'
import { CursorGrammar } from '@/components/motion/CursorGrammar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Pointer grammar for the marketing routes; inert everywhere else. */}
      <CursorGrammar />
      <GlobalNav />
      {/* pb clears the fixed BottomTabBar, which is lg:hidden. This said
          md:pb-0, so the bar overlapped content between md and lg. */}
      <div className="flex-1 pb-20 lg:pb-0">{children}</div>
      <Footer />
      <BottomTabBar />
    </>
  )
}
