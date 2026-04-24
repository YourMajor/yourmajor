'use client'

import * as React from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AvatarProps extends React.ComponentProps<'div'> {
  size?: 'default' | 'sm' | 'lg'
}

function Avatar({ className, size = 'default', children, ...props }: AvatarProps) {
  return (
    <div
      data-slot="avatar"
      data-size={size}
      className={cn(
        'group/avatar relative flex size-8 shrink-0 rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function AvatarImage({ className, src, alt }: Pick<React.ComponentProps<'img'>, 'className' | 'src' | 'alt'>) {
  if (!src) return null
  return (
    <Image
      data-slot="avatar-image"
      src={typeof src === 'string' ? src : ''}
      alt={alt ?? ''}
      fill
      sizes="64px"
      className={cn('aspect-square rounded-full object-cover', className)}
    />
  )
}

function AvatarFallback({ className, children, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs',
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        'absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background select-none',
        'group-data-[size=sm]/avatar:size-2',
        'group-data-[size=default]/avatar:size-2.5',
        'group-data-[size=lg]/avatar:size-3',
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group"
      className={cn('group/avatar-group flex -space-x-2', className)}
      {...props}
    />
  )
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background',
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarBadge }
