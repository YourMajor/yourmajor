import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity'

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
})

const ALLOWLIST = new Set<string>([])

export function containsProfanity(text: string | null | undefined): boolean {
  if (!text) return false
  const normalized = text.toLowerCase().trim()
  if (!normalized) return false
  if (ALLOWLIST.has(normalized)) return false
  return matcher.hasMatch(normalized)
}

export class ProfanityError extends Error {
  field: string
  constructor(field: string) {
    super(`${field} contains inappropriate language. Please revise.`)
    this.name = 'ProfanityError'
    this.field = field
  }
}
