import { getUser } from '@/lib/auth'
import { FeedbackForm } from '@/components/FeedbackForm'

export default async function FeedbackPage() {
  const user = await getUser()
  const userEmail = user?.email ?? undefined

  return (
    <main className="max-w-lg mx-auto px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-heading font-bold">Feedback</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Help us improve YourMajor. Your feedback shapes what we build next.
      </p>
      <div className="mt-8">
        <FeedbackForm defaultEmail={userEmail} />
      </div>
    </main>
  )
}
