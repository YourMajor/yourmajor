import { cva } from 'class-variance-authority'

// Pure function — safe to call from server components
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-lg text-sm font-semibold whitespace-nowrap transition-all select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-border bg-background hover:bg-muted text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted hover:text-foreground',
        destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 gap-1.5 px-3',
        xs: 'h-6 gap-1 px-2 text-xs rounded-md',
        sm: 'h-8 gap-1 px-2.5 text-[0.8rem] rounded-md',
        lg: 'h-12 gap-1.5 px-4',
        icon: 'size-10',
        'icon-xs': 'size-6 rounded-md',
        'icon-sm': 'size-8 rounded-md',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)
