import { cva } from 'class-variance-authority'

// Pure function — safe to call from server components
export const buttonVariants = cva(
  // Disabled is styled per variant rather than with a blanket `opacity-50`:
  // fading a filled button composites its label toward the page ground as fast
  // as its fill, so a green primary at 50% became grey-on-grey (~1.9:1). A
  // muted plate with muted-foreground text reads as inactive and stays legible.
  'inline-flex shrink-0 items-center justify-center rounded-lg text-sm font-semibold whitespace-nowrap transition-all select-none disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground',
        outline:
          'border border-border bg-background hover:bg-muted text-foreground disabled:bg-muted disabled:text-muted-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:bg-muted disabled:text-muted-foreground',
        ghost: 'hover:bg-muted hover:text-foreground disabled:text-muted-foreground',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:bg-muted disabled:text-muted-foreground',
        link: 'text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline',
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
