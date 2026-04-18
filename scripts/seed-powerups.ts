/**
 * Seed script — creates all 30 powerup cards.
 * Run with: npx tsx scripts/seed-powerups.ts
 *
 * Idempotent: uses upsert on slug.
 */
import 'dotenv/config'
import { Prisma, PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

type PowerupSeed = {
  slug: string
  name: string
  type: 'BOOST' | 'ATTACK'
  description: string
  effect: {
    scoring: {
      mode: 'auto' | 'manual' | 'behavioral' | 'variable'
      modifier: number | null
      conditionalKey: string | null
    }
    duration: number
    requiresTarget: boolean
    input: {
      type: 'none' | 'player_select' | 'club_select' | 'number_input' | 'hole_select'
      label: string | null
      count: number | null
    } | null
    restrictions: {
      excludePar3: boolean
    }
    flavorText: string
  }
}

const POWERUPS: PowerupSeed[] = [
  // ─── BOOST CARDS (18) ──────────────────────────────────────────────────────

  {
    slug: 'shots-for-shots',
    name: 'Shots for Shots',
    type: 'BOOST',
    description: 'Take a shot (drink), subtract that many strokes from your hole score.',
    effect: {
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'drink_count' },
      duration: 1,
      requiresTarget: false,
      input: { type: 'number_input', label: 'How many shots (drinks) did you take?', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Liquid courage has its rewards.',
    },
  },
  {
    slug: 'walk-it-in',
    name: 'Walk it in',
    type: 'BOOST',
    description: 'Pick up your ball, take up to 10 steps toward the hole, and drop it from knee height. Play from where it lands.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: "Why putt when you can walk?",
    },
  },
  {
    slug: 'left-on-red',
    name: 'Left on Red',
    type: 'BOOST',
    description: 'Tee off from the front tees on a hole of your choice.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Sometimes the shortcut is the best route.',
    },
  },
  {
    slug: 'concede',
    name: 'Concede!',
    type: 'BOOST',
    description: 'If you hit a green in regulation, your score is automatically a one-putt birdie.',
    effect: {
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'gir_check' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: "That's good. Pick it up.",
    },
  },
  {
    slug: 'can-i-get-your-number',
    name: "Can I Get Your Number?",
    type: 'BOOST',
    description: 'Ask the cart girl (or a random bystander) to pick a number 1–10. That becomes your hole score.',
    effect: {
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'random_number' },
      duration: 1,
      requiresTarget: false,
      input: { type: 'number_input', label: 'What number did they pick? (1-10)', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Fate decides your score.",
    },
  },
  {
    slug: 'the-sandman',
    name: 'The Sandman',
    type: 'BOOST',
    description: 'Use your driver in a bunker (up to 4 attempts to escape). If you succeed, subtract 4 from your hole score.',
    effect: {
      scoring: { mode: 'auto', modifier: -4, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: "Enter Sandman.",
    },
  },
  {
    slug: 'iron-man',
    name: 'Iron Man',
    type: 'BOOST',
    description: 'Use only irons for the entire hole. Subtract 2 from your score. Cannot be used on par 3s.',
    effect: {
      scoring: { mode: 'auto', modifier: -2, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: true },
      flavorText: "Real golfers don't need woods.",
    },
  },
  {
    slug: 'king-of-the-hill',
    name: 'King of the Hill',
    type: 'BOOST',
    description: 'Select up to 3 playing partners. For each consecutive hole you win outright against all of them, gain -1 to your total score. Streak ends when any partner ties or beats you.',
    effect: {
      scoring: { mode: 'variable', modifier: null, conditionalKey: 'consecutive_wins' },
      duration: -1,
      requiresTarget: false,
      input: { type: 'player_select', label: 'Select up to 3 playing partners to compete against', count: 3 },
      restrictions: { excludePar3: false },
      flavorText: "Stay on top or fall off.",
    },
  },
  {
    slug: 'best-buddies',
    name: 'Best Buddies',
    type: 'BOOST',
    description: 'Choose a partner. You both play the hole and take the best ball between you.',
    effect: {
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'best_ball' },
      duration: 1,
      requiresTarget: false,
      input: { type: 'player_select', label: 'Select your partner', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Teamwork makes the dream work.",
    },
  },
  {
    slug: 'the-long-drive',
    name: 'The Long Drive',
    type: 'BOOST',
    description: 'If you outdrive a chosen partner off the tee, drop your ball 10 yards past theirs.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: { type: 'player_select', label: 'Select partner to outdrive', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Grip it and rip it.",
    },
  },
  {
    slug: 'bunker-buster',
    name: 'Bunker Buster',
    type: 'BOOST',
    description: 'Each bunker you intentionally enter on this hole subtracts 1 from your score.',
    effect: {
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'bunkers_entered' },
      duration: 1,
      requiresTarget: false,
      input: { type: 'number_input', label: 'How many bunkers did you enter?', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Sand is your friend today.",
    },
  },
  {
    slug: '1-vs-all',
    name: '1 vs ALL',
    type: 'BOOST',
    description: 'Challenge all partners on one hole. If you beat everyone outright, subtract 2 from your score. If you lose, every other player gets -1.',
    effect: {
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'beat_all_check' },
      duration: 1,
      requiresTarget: false,
      input: { type: 'number_input', label: 'Did you beat all partners? (Enter -2 if won, 0 if lost)', count: null },
      restrictions: { excludePar3: false },
      flavorText: "One against the world.",
    },
  },
  {
    slug: 'drive-for-show-putt-for-dough',
    name: 'Drive for Show, Putt for Dough',
    type: 'BOOST',
    description: 'Skip either your driver or putter for the entire hole. Subtract 1 from your score.',
    effect: {
      scoring: { mode: 'auto', modifier: -1, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: "Choose your weapon — or lack thereof.",
    },
  },
  {
    slug: 'the-fluffer',
    name: 'The Fluffer',
    type: 'BOOST',
    description: 'Unlimited lie fluffing or tee-ups anywhere on the hole (including fairway and rough).',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: "Every lie is a perfect lie.",
    },
  },
  {
    slug: 'skipping-stones',
    name: 'Skipping Stones',
    type: 'BOOST',
    description: 'If your ball enters a water hazard, drop on the other side with no penalty stroke.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: "Water? What water?",
    },
  },
  {
    slug: 'fairway-finder',
    name: 'Fairway Finder',
    type: 'BOOST',
    description: 'Declare how many consecutive fairways you will hit. If you reach your target (par 3s excluded), subtract that number from your gross score. Miss one and the challenge fails.',
    effect: {
      scoring: { mode: 'variable', modifier: null, conditionalKey: 'consecutive_fairways' },
      duration: -1,
      requiresTarget: false,
      input: { type: 'number_input', label: 'How many consecutive fairways will you hit? (excluding par 3s)', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Keep it in the short grass.",
    },
  },
  {
    slug: 'playing-with-yourself',
    name: 'Playing with Yourself',
    type: 'BOOST',
    description: 'Play the hole twice and take the better score (best ball with yourself).',
    effect: {
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'best_of_two' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: "Two tries are better than one.",
    },
  },
  {
    slug: 'happy-gilmore',
    name: 'Happy Gilmore',
    type: 'BOOST',
    description: 'Attempt an unconventional swing (running start, one-handed, etc.) on your tee shot. If you use it, subtract 1.',
    effect: {
      scoring: { mode: 'auto', modifier: -1, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: "It's all in the hips.",
    },
  },

  // ─── ATTACK CARDS (12) ─────────────────────────────────────────────────────

  {
    slug: 'just-the-tip',
    name: 'Just the Tip',
    type: 'ATTACK',
    description: 'Force an opponent to play from the championship (back) tees on this hole.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent to attack', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Hope you brought your big boy clubs.",
    },
  },
  {
    slug: 'club-roulette',
    name: 'Club Roulette',
    type: 'ATTACK',
    description: "Choose a club your opponent must use for their next shot. They can't switch.",
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'club_select', label: 'Select club for opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Hope you like your 60-degree on a par 5.",
    },
  },
  {
    slug: 'drink-up',
    name: 'Drink Up!',
    type: 'ATTACK',
    description: 'Opponent must finish their drink before reaching the green. If they fail, add 2 to their score.',
    effect: {
      scoring: { mode: 'manual', modifier: 2, conditionalKey: 'drink_failed' },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent to attack', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Bottoms up, buttercup.",
    },
  },
  {
    slug: 'parent-trap',
    name: 'Parent Trap',
    type: 'ATTACK',
    description: 'After the hole is complete, swap your score with the chosen opponent.',
    effect: {
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'score_swap' },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent to swap scores with', count: null },
      restrictions: { excludePar3: false },
      flavorText: "What's yours is mine.",
    },
  },
  {
    slug: 'the-fairway-is-lava',
    name: 'The Fairway is Lava',
    type: 'ATTACK',
    description: "Each time your opponent's ball touches the fairway, add 1 to their score.",
    effect: {
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'fairway_touches' },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent to attack', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Stay off the short grass!",
    },
  },
  {
    slug: 'proximity-mine',
    name: 'Proximity Mine',
    type: 'ATTACK',
    description: 'Pick 3 future holes. If your opponent lands within 2 club lengths of a bunker on any of them, add 1 per occurrence.',
    effect: {
      scoring: { mode: 'manual', modifier: null, conditionalKey: 'proximity_trigger' },
      duration: 1,
      requiresTarget: true,
      input: { type: 'hole_select', label: 'Select 3 future holes to mine', count: 3 },
      restrictions: { excludePar3: false },
      flavorText: "Watch your step.",
    },
  },
  {
    slug: 'the-long-and-winding-road',
    name: 'The Long and Winding Road',
    type: 'ATTACK',
    description: "Your opponent's ball must visit both the left AND right rough before reaching the green. If they fail, add 2 to their score.",
    effect: {
      scoring: { mode: 'manual', modifier: 2, conditionalKey: 'rough_visit_failed' },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent to attack', count: null },
      restrictions: { excludePar3: false },
      flavorText: "The scenic route is mandatory.",
    },
  },
  {
    slug: 'go-for-glory',
    name: 'Go for Glory',
    type: 'ATTACK',
    description: "Once your opponent's ball is on the green, move it to any other spot on the green.",
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent to attack', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Nice putt... from over there.",
    },
  },
  {
    slug: 'beach-boys',
    name: 'Beach Boys',
    type: 'ATTACK',
    description: 'When your ball lands in a bunker, move your opponent\'s ball into the same bunker as a reaction.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent to drag into the bunker', count: null },
      restrictions: { excludePar3: false },
      flavorText: "If I'm going down, you're coming with me.",
    },
  },
  {
    slug: 'freaky-friday',
    name: 'Freaky Friday',
    type: 'ATTACK',
    description: 'Swap ball locations with an opponent at any point during the hole. Both continue with the same shot count.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent to swap ball positions with', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Walk a mile in their shoes... or play from their lie.",
    },
  },
  {
    slug: 'the-texas-wedge',
    name: 'The Texas Wedge',
    type: 'ATTACK',
    description: 'If your opponent is within 50 yards of the green, they must use only their putter until the ball is in the hole.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent to attack', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Putter from 50 yards? Good luck.",
    },
  },
  {
    slug: 'worst-ball',
    name: 'Worst Ball',
    type: 'ATTACK',
    description: 'Your opponent must play worst-ball with themselves for the entire hole (hit two balls, play the worse one each time).',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent to attack', count: null },
      restrictions: { excludePar3: false },
      flavorText: "Double the balls, double the pain.",
    },
  },
]

async function main() {
  console.log('Seeding powerup cards...\n')

  for (const p of POWERUPS) {
    const powerup = await prisma.powerup.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        type: p.type,
        description: p.description,
        effect: p.effect as Prisma.InputJsonValue,
      },
      create: {
        slug: p.slug,
        name: p.name,
        type: p.type,
        description: p.description,
        effect: p.effect as Prisma.InputJsonValue,
      },
    })
    const icon = p.type === 'BOOST' ? '🟢' : '🔴'
    console.log(`  ${icon} ${powerup.name} (${p.type})`)
  }

  const boosts = POWERUPS.filter((p) => p.type === 'BOOST').length
  const attacks = POWERUPS.filter((p) => p.type === 'ATTACK').length
  console.log(`\nDone. Seeded ${POWERUPS.length} powerups (${boosts} boosts, ${attacks} attacks).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
