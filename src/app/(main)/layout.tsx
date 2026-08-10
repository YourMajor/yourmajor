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
      {/* ScrollSmoother structure: the landing page activates a smoother on
          these ids (SmoothScroll); on every other route they are inert
          pass-through wrappers. The sticky GlobalNav and fixed BottomTabBar
          stay outside the smoothed content on purpose — a transformed
          ancestor breaks fixed/sticky positioning. */}
      <div id="smooth-wrapper" className="flex flex-1 flex-col">
        <div id="smooth-content" className="flex flex-1 flex-col">
          {/* pb clears the fixed BottomTabBar, which is lg:hidden. This said
              md:pb-0, so the bar overlapped content between md and lg. */}
          <div className="flex-1 pb-20 lg:pb-0">{children}</div>
          <Footer />
        </div>
      </div>
      <BottomTabBar />
    </>
  )
}
