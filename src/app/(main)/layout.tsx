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
          {/* No padding here. Clearance for the fixed BottomTabBar lives in
              Footer, on an element that actually paints a background: this
              wrapper is transparent, so 80px of it below the page's own
              ground showed as a band of app paper — a white strip under the
              green on every marketing route, phone only. */}
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
      </div>
      <BottomTabBar />
    </>
  )
}
