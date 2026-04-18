import { GlobalNav } from '@/components/GlobalNav'
import { Footer } from '@/components/Footer'
import { BottomTabBar } from '@/components/BottomTabBar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalNav />
      <div className="flex-1 pb-20 md:pb-0">{children}</div>
      <Footer />
      <BottomTabBar />
    </>
  )
}
