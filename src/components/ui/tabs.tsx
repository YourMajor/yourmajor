'use client'

import * as React from 'react'
import MuiTabs from '@mui/material/Tabs'
import MuiTab from '@mui/material/Tab'
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
  'inline-flex w-fit items-center justify-start text-muted-foreground',
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

function TabsList({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof tabsListVariants>) {
  const { value, onValueChange } = React.useContext(TabsContext)

  return (
    <MuiTabs
      value={value}
      onChange={(_, newVal) => onValueChange(newVal)}
      variant="scrollable"
      scrollButtons={false}
      className={cn(tabsListVariants({ variant }), className)}
      sx={{
        minHeight: 'unset',
        '& .MuiTabs-indicator': {
          backgroundColor: variant === 'line' ? 'var(--color-primary, #006747)' : 'transparent',
          height: variant === 'line' ? 2 : 0,
        },
      }}
      {...(props as any)}
    >
      {children}
    </MuiTabs>
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
  [key: string]: any
}) {
  return (
    <MuiTab
      value={value}
      label={children}
      className={cn(
        '!text-sm !font-medium !normal-case !min-w-0 !min-h-0 !px-3 !py-1.5',
        className
      )}
      sx={{
        color: 'var(--muted-foreground, #6b7c6b)',
        '&.Mui-selected': {
          color: 'var(--foreground, #1a2e1a)',
          fontWeight: 600,
        },
      }}
      {...props}
    />
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
  [key: string]: any
}) {
  const { value: activeValue } = React.useContext(TabsContext)
  if (activeValue !== value) return null

  return (
    <div data-slot="tabs-content" className={cn('flex-1 text-sm outline-none', className)} {...props}>
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
