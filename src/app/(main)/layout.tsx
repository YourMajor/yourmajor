import { GlobalNav } from '@/components/GlobalNav'
import { Footer } from '@/components/Footer'
import { BottomTabBar } from '@/components/BottomTabBar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalNav />
      {/* pb clears the fixed BottomTabBar, which is lg:hidden. This said
          md:pb-0, so the bar overlapped content between md and lg. */}
      <div className="flex-1 pb-20 lg:pb-0">{children}</div>
      <Footer />
      <BottomTabBar />
    </>
  )
}
