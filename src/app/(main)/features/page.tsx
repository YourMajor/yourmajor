import { redirect } from 'next/navigation'

/**
 * Features moved onto the landing page. This route is kept as a redirect so
 * existing links, bookmarks and the mobile tab bar keep working.
 */
export default function FeaturesPage() {
  redirect('/#features')
}
