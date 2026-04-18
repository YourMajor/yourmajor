'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface DateFilterTabsProps {
  availableMonths: string[]
  activeMonth: string
  onMonthChange: (month: string) => void
}

export function DateFilterTabs({ availableMonths, activeMonth, onMonthChange }: DateFilterTabsProps) {
  return (
    <Tabs value={activeMonth} onValueChange={onMonthChange}>
      <TabsList className="bg-transparent gap-0 h-auto p-0 border-b border-border">
        {availableMonths.map((month) => (
          <TabsTrigger
            key={month}
            value={month}
            className="text-xs uppercase tracking-wider font-semibold px-4 py-2
              rounded-none border-b-2 border-transparent
              text-muted-foreground
              data-[state=active]:border-accent
              data-[state=active]:text-foreground
              data-[state=active]:bg-transparent
              data-[state=active]:shadow-none"
          >
            {month}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
