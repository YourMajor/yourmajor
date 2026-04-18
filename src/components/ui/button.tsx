'use client'

import MuiButton from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import { cn } from '@/lib/utils'

// Re-export buttonVariants from the server-safe module
export { buttonVariants } from './button-variants'

type MuiVariant = 'contained' | 'outlined' | 'text'
type MuiColor = 'primary' | 'secondary' | 'error' | 'inherit'
type MuiSize = 'small' | 'medium' | 'large'

function mapVariant(v?: string | null): { muiVariant: MuiVariant; muiColor: MuiColor } {
  switch (v) {
    case 'outline': return { muiVariant: 'outlined', muiColor: 'primary' }
    case 'secondary': return { muiVariant: 'contained', muiColor: 'secondary' }
    case 'ghost': return { muiVariant: 'text', muiColor: 'inherit' }
    case 'destructive': return { muiVariant: 'contained', muiColor: 'error' }
    case 'link': return { muiVariant: 'text', muiColor: 'primary' }
    default: return { muiVariant: 'contained', muiColor: 'primary' }
  }
}

function mapSize(s?: string | null): MuiSize {
  switch (s) {
    case 'xs': case 'sm': case 'icon-xs': case 'icon-sm': return 'small'
    case 'lg': case 'icon-lg': return 'large'
    default: return 'medium'
  }
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'
}

function Button({ className, variant = 'default', size = 'default', style, children, ...props }: ButtonProps) {
  const { muiVariant, muiColor } = mapVariant(variant)
  const muiSize = mapSize(size)
  const isIcon = size?.toString().startsWith('icon')

  if (isIcon) {
    return (
      <IconButton
        color={muiColor}
        size={muiSize}
        className={cn(className)}
        style={style}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </IconButton>
    )
  }

  return (
    <MuiButton
      variant={muiVariant}
      color={muiColor}
      size={muiSize}
      className={cn(className)}
      style={style}
      disableElevation
      {...(props as Record<string, unknown>)}
    >
      {children}
    </MuiButton>
  )
}

export { Button }
