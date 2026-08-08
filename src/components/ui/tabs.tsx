'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (v: string) => void
  orientation: 'horizontal' | 'vertical'
}

const TabsContext = React.createContext<TabsContextValue>({
  value: '',
  onValueChange: () => {},
  orientation: 'horizontal',
})

function Tabs({
  className,
  orientation = 'horizontal',
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  ...props
}: {
  className?: string
  orientation?: 'horizontal' | 'vertical'
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '')
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue
  const handleChange = (v: string) => {
    if (!isControlled) setInternalValue(v)
    onValueChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ value, onValueChange: handleChange, orientation }}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn('flex gap-2', orientation === 'horizontal' ? 'flex-col' : '', className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const tabsListVariants = cva(
  'inline-flex w-fit max-w-full items-center justify-start overflow-x-auto text-muted-foreground',
  {
    variants: {
      variant: {
        default: 'bg-muted rounded-lg p-[3px] h-8',
        line: 'gap-1 bg-transparent border-b border-border',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

const TabsListContext = React.createContext<'default' | 'line'>('default')

function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLDivElement>(null)

  // Roving arrow-key navigation between the tab buttons.
  function onKeyDown(e: React.KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? []
    )
    if (tabs.length === 0) return
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement)
    let next = current
    if (e.key === 'ArrowLeft') next = current <= 0 ? tabs.length - 1 : current - 1
    if (e.key === 'ArrowRight') next = current === tabs.length - 1 ? 0 : current + 1
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = tabs.length - 1
    tabs[next]?.focus()
    tabs[next]?.click()
    e.preventDefault()
  }

  return (
    <TabsListContext.Provider value={variant ?? 'default'}>
      <div
        ref={listRef}
        role="tablist"
        data-slot="tabs-list"
        onKeyDown={onKeyDown}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      >
        {children}
      </div>
    </TabsListContext.Provider>
  )
}

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: {
  className?: string
  value: string
  children: React.ReactNode
  [key: string]: unknown
}) {
  const { value: activeValue, onValueChange } = React.useContext(TabsContext)
  const variant = React.useContext(TabsListContext)
  const selected = activeValue === value

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-slot="tabs-trigger"
      data-state={selected ? 'active' : 'inactive'}
      onClick={() => onValueChange(value)}
      className={cn(
        'shrink-0 whitespace-nowrap px-3 py-1.5 text-sm font-medium transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        variant === 'line'
          ? cn(
              '-mb-px border-b-2',
              selected
                ? 'border-primary font-semibold text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )
          : cn(
              'h-full rounded-md',
              selected
                ? 'bg-background font-semibold text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            ),
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({
  className,
  value,
  children,
  ...props
}: {
  className?: string
  value: string
  children: React.ReactNode
  [key: string]: unknown
}) {
  const { value: activeValue } = React.useContext(TabsContext)
  if (activeValue !== value) return null

  return (
    <div
      role="tabpanel"
      data-slot="tabs-content"
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
