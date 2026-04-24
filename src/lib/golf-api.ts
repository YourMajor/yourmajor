/**
 * GolfCourseAPI.com client
 * Docs: https://api.golfcourseapi.com/docs/api/
 * Auth: Key token via GOLF_COURSE_API_KEY env var
 * Sign up (free, 300 req/day): https://golfcourseapi.com/sign-in
 */

const BASE_URL = 'https://api.golfcourseapi.com'

function getHeaders() {
  const key = process.env.GOLF_COURSE_API_KEY
  if (!key) throw new Error('GOLF_COURSE_API_KEY is not set')
  return {
    Authorization: `Key ${key}`,
    'Content-Type': 'application/json',
  }
}

// ─── Response types ────────────────────────────────────────────────────────

export type GolfCourseApiHole = {
  par: number
  yardage: number
  handicap: number  // stroke index (1–18)
}

export type GolfCourseApiTeeBox = {
  tee_name: string
  course_rating: number | null
  slope_rating: number | null
  total_yards: number
  total_meters: number | null
  number_of_holes: number
  par_total: number
  holes: GolfCourseApiHole[]
}

export type GolfCourseApiLocation = {
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

export type GolfCourseApiCourse = {
  id: number
  club_name: string
  course_name: string
  location: GolfCourseApiLocation
  tees: {
    female: GolfCourseApiTeeBox[]
    male: GolfCourseApiTeeBox[]
  }
}

export type GolfCourseApiSearchResponse = {
  courses: GolfCourseApiCourse[]
}

// ─── API calls ─────────────────────────────────────────────────────────────

/**
 * Search courses by name. Returns matching courses with full tee/hole data.
 */
export const GOLF_COURSE_CACHE_TAG = 'golf-courses'

export async function searchCourses(query: string): Promise<GolfCourseApiCourse[]> {
  const url = `${BASE_URL}/v1/search?search_query=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 3600, tags: [GOLF_COURSE_CACHE_TAG] },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GolfCourseAPI /v1/search error ${res.status}: ${text}`)
  }
  const data: GolfCourseApiSearchResponse = await res.json()
  return data.courses ?? []
}

/**
 * Fetch a single course by its numeric ID (includes full tee/hole data).
 * Response is wrapped: { course: GolfCourseApiCourse }
 */
export async function getCourseById(id: number): Promise<GolfCourseApiCourse> {
  const url = `${BASE_URL}/v1/courses/${id}`
  const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GolfCourseAPI /v1/courses/${id} error ${res.status}: ${text}`)
  }
  const data: { course: GolfCourseApiCourse } = await res.json()
  return data.course
}

/**
 * Helper — pick a representative tee array (prefer male, fall back to female).
 * The first tee's holes carry the canonical par + stroke index for each hole.
 */
export function getCanonicalTees(course: GolfCourseApiCourse): GolfCourseApiTeeBox[] {
  return course.tees.male?.length ? course.tees.male : course.tees.female ?? []
}
