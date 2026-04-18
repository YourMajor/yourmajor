'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Star, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const feedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  category: z.enum(['bug', 'feature', 'general', 'other']),
  message: z
    .string()
    .min(10, 'Please provide at least 10 characters')
    .max(500, 'Maximum 500 characters'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
})

type FeedbackFormData = z.infer<typeof feedbackSchema>

const CATEGORY_OPTIONS = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'general', label: 'General Feedback' },
  { value: 'other', label: 'Other' },
] as const

interface FeedbackFormProps {
  defaultEmail?: string
}

export function FeedbackForm({ defaultEmail }: FeedbackFormProps) {
  const [hoveredStar, setHoveredStar] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      rating: 0,
      category: 'general',
      message: '',
      email: defaultEmail ?? '',
    },
  })

  const rating = watch('rating')
  const message = watch('message')
  const category = watch('category')

  const startCooldown = useCallback(() => {
    setCooldown(true)
    const timer = setTimeout(() => setCooldown(false), 30_000)
    return () => clearTimeout(timer)
  }, [])

  const onSubmit = async (data: FeedbackFormData) => {
    setSubmitError(null)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? 'Something went wrong. Please try again.')
      }

      setSubmitted(true)
      startCooldown()
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      )
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-xl font-heading font-bold">
          Thank you for your feedback!
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          We appreciate you taking the time to help us improve.
        </p>
        <Button
          className="mt-6"
          variant="outline"
          disabled={cooldown}
          onClick={() => setSubmitted(false)}
        >
          {cooldown ? 'Please wait...' : 'Send more feedback'}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Rating */}
      <div className="space-y-2">
        <Label>Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= (hoveredStar || rating)
            return (
              <button
                key={star}
                type="button"
                className="h-12 w-12 flex items-center justify-center rounded-md transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setValue('rating', star, { shouldValidate: true })}
                aria-label={`Rate ${star} out of 5`}
              >
                <Star
                  className={`h-7 w-7 transition-colors ${
                    filled
                      ? 'fill-accent text-accent'
                      : 'fill-transparent text-muted-foreground'
                  }`}
                />
              </button>
            )
          })}
        </div>
        {errors.rating && (
          <p className="text-sm text-destructive">{errors.rating.message ?? 'Please select a rating'}</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          value={category}
          onChange={(e) =>
            setValue('category', e.target.value as FeedbackFormData['category'], {
              shouldValidate: true,
            })
          }
          className="flex h-11 md:h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 md:text-sm"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="text-sm text-destructive">{errors.category.message}</p>
        )}
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          rows={4}
          placeholder="Tell us what's on your mind..."
          {...register('message')}
        />
        <div className="flex items-center justify-between">
          {errors.message ? (
            <p className="text-sm text-destructive">{errors.message.message}</p>
          ) : (
            <span />
          )}
          <span
            className={`text-xs tabular-nums ${
              (message?.length ?? 0) > 500
                ? 'text-destructive'
                : 'text-muted-foreground'
            }`}
          >
            {message?.length ?? 0}/500
          </span>
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email (optional)</Label>
        <Input
          id="email"
          type="email"
          placeholder="your@email.com"
          {...register('email')}
        />
        <p className="text-xs text-muted-foreground">
          We&apos;ll only use this to follow up on your feedback
        </p>
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Error */}
      {submitError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{submitError}</p>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className="w-full min-h-[48px]"
        disabled={isSubmitting || cooldown}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          'Submit Feedback'
        )}
      </Button>
    </form>
  )
}
