'use client'

import * as React from 'react'
import MuiSelect from '@mui/material/Select'
import MuiMenuItem from '@mui/material/MenuItem'
import MuiFormControl from '@mui/material/FormControl'
import MuiListSubheader from '@mui/material/ListSubheader'
import MuiDivider from '@mui/material/Divider'
import { cn } from '@/lib/utils'

// Context to pass value/onChange through the component tree
interface SelectContextValue {
  value: string
  onValueChange: (v: string) => void
}

const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  onValueChange: () => {},
})

function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  children,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
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
    <SelectContext.Provider value={{ value, onValueChange: handleChange }}>
      {children}
    </SelectContext.Provider>
  )
}

function SelectGroup({ className, children, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-1', className)} {...props}>{children}</div>
}

function SelectValue({ className, placeholder, ...props }: React.ComponentProps<'span'> & { placeholder?: string }) {
  const { value } = React.useContext(SelectContext)
  return <span className={cn('flex flex-1 text-left', className)} {...props}>{value || placeholder}</span>
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<'div'> & { size?: 'sm' | 'default' }) {
  const { value, onValueChange } = React.useContext(SelectContext)

  // Collect SelectItem children to build options
  return (
    <MuiFormControl size={size === 'sm' ? 'small' : 'medium'} className={cn('min-w-[120px]', className)}>
      <MuiSelect
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        displayEmpty
        className="!rounded-lg !text-sm"
        sx={{
          height: size === 'sm' ? 28 : 36,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--border, rgba(0,0,0,0.12))',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--color-primary, #006747)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--color-primary, #006747)',
          },
        }}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </MuiSelect>
    </MuiFormControl>
  )
}

function SelectContent({
  children,
}: React.ComponentProps<'div'> & { side?: string; sideOffset?: number; align?: string; alignOffset?: number; alignItemWithTrigger?: boolean }) {
  // MUI Select handles its own dropdown rendering
  // This is a passthrough for compatibility
  return <>{children}</>
}

function SelectLabel({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <MuiListSubheader className={cn('!text-xs !text-muted-foreground', className)} {...(props as Record<string, unknown>)}>
      {children}
    </MuiListSubheader>
  )
}

function SelectItem({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<'div'> & { value: string }) {
  return (
    <MuiMenuItem value={value} className={cn('!text-sm', className)} {...(props as Record<string, unknown>)}>
      {children}
    </MuiMenuItem>
  )
}

function SelectSeparator({ className, ...props }: React.ComponentProps<'hr'>) {
  return <MuiDivider className={cn('!my-1', className)} {...(props as Record<string, unknown>)} />
}

function SelectScrollUpButton() { return null }
function SelectScrollDownButton() { return null }

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
