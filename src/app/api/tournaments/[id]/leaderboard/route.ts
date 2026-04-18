import { NextRequest, NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/scoring'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const roundId = request.nextUrl.searchParams.get('roundId') ?? undefined
  const standings = await getLeaderboard(id, roundId)
  return NextResponse.json(standings)
}
