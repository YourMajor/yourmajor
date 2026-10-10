/**
 * Seed script — defines every powerup card and applies retirements.
 *
 * Retired cards (see RETIRED below) stay in the table so finished tournaments
 * keep their history, but are filtered out of new pools.
 * Run with: npx tsx scripts/seed-powerups.ts
 *
 * Idempotent: uses upsert on slug.
 */
import 'dotenv/config'
import { Prisma, PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { powerupEffectSchema, type PowerupEffect } from '../src/lib/powerup-engine'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// The effect shape comes from the engine's zod schema rather than a local
// copy: a card that declares something the engine would reject now fails at
// typecheck instead of at activation time.
type PowerupSeed = {
  slug: string
  name: string
  type: 'BOOST' | 'ATTACK'
  description: string
  effect: PowerupEffect
}

const POWERUPS: PowerupSeed[] = [
  // ─── BOOST CARDS (18) ──────────────────────────────────────────────────────

  {
    slug: 'shots-for-shots',
    name: 'Shots for Shots',
    type: 'BOOST',
    description: 'Take a shot (drink), subtract that many strokes from your hole score.',
    effect: {
      scoring: { mode: 'manual', modifier: -1, conditionalKey: 'drink_count' },
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
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
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
      input: null,
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
      scoring: { mode: 'manual', modifier: -1, conditionalKey: 'bunkers_entered' },
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
      scoring: { mode: 'manual', modifier: -2, conditionalKey: 'beat_all_check' },
      duration: 1,
      requiresTarget: false,
      input: null,
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
      // Pure rule-change: player just enters their better score directly into
      // the hole input. No modifier needed.
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
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
    description: 'Pick an opponent and a hole. Your scores on that hole switch once you both finish the round.',
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
      scoring: { mode: 'manual', modifier: 1, conditionalKey: 'fairway_touches' },
      duration: 1,
      requiresTarget: true,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: "Stay off the short grass!",
    },
  },
  {
    slug: 'proximity-mine',
    name: 'Proximity Mine',
    type: 'ATTACK',
    description: "Each time opponent's ball lands within 2 club lengths of a bunker on this hole, add 1 to their score.",
    effect: {
      scoring: { mode: 'manual', modifier: 1, conditionalKey: 'proximity_trigger' },
      duration: 1,
      requiresTarget: true,
      input: null,
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
      requiresTarget: false,
      input: null,
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
// --- NEW BOOST CARDS (32) ---

  {
    slug: 'stinger',
    name: 'Stinger',
    type: 'BOOST',
    description: 'Hit a knockdown shot off the tee — follow-through must stay below your shoulders. Subtract 1. If you fail, no payoff.',
    effect: {
      scoring: { mode: 'auto', modifier: -1, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Low and slow.',
    },
  },
  {
    slug: 'lefty-loosey',
    name: 'Lefty Loosey',
    type: 'BOOST',
    description: 'Play one full shot opposite-handed this hole. Subtract 1. Can be activated at any time.',
    effect: {
      scoring: { mode: 'auto', modifier: -1, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Switch hitter.',
    },
  },
  {
    slug: 'mulligan',
    name: 'Mulligan',
    type: 'BOOST',
    description: 'Re-tee any shot of your choosing on this hole, no penalty. Subtract 1.',
    effect: {
      scoring: { mode: 'auto', modifier: -1, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Do-overs are free today.',
    },
  },
  {
    slug: 'foot-wedge',
    name: 'Foot Wedge',
    type: 'BOOST',
    description: 'For 9 holes, you can move every shot one club length from its original position, no closer to the hole.',
    effect: {
      scoring: { mode: 'windowed', modifier: 0, conditionalKey: 'none', bank: 'none' },
      duration: 9,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Best wedge in the bag.',
    },
  },
  {
    slug: 'tee-it-high',
    name: 'Tee It High',
    type: 'BOOST',
    description: 'Use a 4+ inch tee for your tee shot. Subtract 1.',
    effect: {
      scoring: { mode: 'auto', modifier: -1, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Reach for the sky.',
    },
  },
  {
    slug: 'the-comeback',
    name: 'The Comeback',
    type: 'BOOST',
    description: 'What ever you scored on the previous hole? If you better that score your next hole, -1 to the total.',
    effect: {
      scoring: { mode: 'manual', modifier: -1, conditionalKey: 'improved_previous_score' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Bounce back stronger.',
    },
  },
  {
    slug: 'up-and-down-artist',
    name: 'Up & Down Artist',
    type: 'BOOST',
    description: 'If you get up-and-down from off the green (chip + putt), subtract 3.',
    effect: {
      scoring: { mode: 'manual', modifier: -3, conditionalKey: 'up_and_down' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Short game wizardry.',
    },
  },
  {
    slug: 'sand-save',
    name: 'Sand Save',
    type: 'BOOST',
    description: 'If you save par from a bunker, subtract 3.',
    effect: {
      scoring: { mode: 'manual', modifier: -3, conditionalKey: 'sand_save' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Beach to par.',
    },
  },
  {
    slug: 'the-tin-cup',
    name: 'The Tin Cup',
    type: 'BOOST',
    description: 'Play the entire hole using only your 7-iron (including putts). If you score par or better, subtract 3.',
    effect: {
      scoring: { mode: 'manual', modifier: -3, conditionalKey: 'tin_cup_par' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: true },
      flavorText: 'Roy McAvoy approves.',
    },
  },
  {
    slug: 'pin-seeker',
    name: 'Pin Seeker',
    type: 'BOOST',
    description: 'If your tee shot lands within 10 feet of the pin from any spot >40 yards from the hole, subtract 2.',
    effect: {
      scoring: { mode: 'manual', modifier: -2, conditionalKey: 'pin_proximity' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Dart thrower.',
    },
  },
  {
    slug: 'long-bomb',
    name: 'Long Bomb',
    type: 'BOOST',
    description: 'If your tee shot finishes in the fairway and travels 250+ yards, subtract 2.',
    effect: {
      scoring: { mode: 'manual', modifier: -2, conditionalKey: 'long_drive_fairway' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: true },
      flavorText: 'Bombs away.',
    },
  },
  {
    slug: 'greenside-magic',
    name: 'Greenside Magic',
    type: 'BOOST',
    description: 'If your first chip from off the green finishes within 3 feet, subtract 2.',
    effect: {
      scoring: { mode: 'manual', modifier: -2, conditionalKey: 'chip_proximity' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Touch of a surgeon.',
    },
  },
  {
    slug: 'one-putt-wonder',
    name: 'One-Putt Wonder',
    type: 'BOOST',
    description: '9-hole window. Each hole you one-putt, subtract 1 from your total score.',
    effect: {
      scoring: { mode: 'windowed', modifier: -1, conditionalKey: 'one_putt', bank: 'sum' },
      duration: 9,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Drains for days.',
    },
  },
  {
    slug: 'the-closer',
    name: 'The Closer',
    type: 'BOOST',
    description: 'If you sink a putt of 10 feet or longer, subtract 2.',
    effect: {
      scoring: { mode: 'manual', modifier: -2, conditionalKey: 'long_putt' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Money under pressure.',
    },
  },
  {
    slug: 'albatross-aim',
    name: 'Albatross Aim',
    type: 'BOOST',
    description: 'Activate this card after your drive on a par 5. If you reach the green in 2 shots, subtract 3.',
    effect: {
      scoring: { mode: 'manual', modifier: -3, conditionalKey: 'par5_in_two' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: true },
      flavorText: 'Going for it.',
    },
  },
  {
    slug: 'chip-in-bonus',
    name: 'Chip-In Bonus',
    type: 'BOOST',
    description: 'If you chip in from off the green, subtract an additional 3. Can be activated afte the chip in.',
    effect: {
      scoring: { mode: 'manual', modifier: -3, conditionalKey: 'chip_in' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'From off the dance floor.',
    },
  },
  {
    slug: 'drop-zone',
    name: 'Drop Zone',
    type: 'BOOST',
    description: 'Take a free drop within one club length of any spot on the hole, no closer to hole, no penalty.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Better lie ahead.',
    },
  },
  {
    slug: 'the-re-do',
    name: 'The Re-Do',
    type: 'BOOST',
    description: 'Hit a second tee shot if you don\'t like the first. Pick the better one. No stroke penalty.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Second time\'s the charm.',
    },
  },
  {
    slug: 'brush-it-off',
    name: 'Brush It Off',
    type: 'BOOST',
    description: 'Improve your lie one club length anywhere on this hole, including rough or fairway divots.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Tidy up the lie.',
    },
  },
  {
    slug: 'the-gimme',
    name: 'The Gimme',
    type: 'BOOST',
    description: 'Any putt inside the leather (3 feet) is automatic. Don\'t actually putt them.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'That\'s good.',
    },
  },
  {
    slug: 'the-dropdown',
    name: 'The Dropdown',
    type: 'BOOST',
    description: 'Activate after finding a hazard on a shot. Take a no-penalty drop out of any hazard (water, OB, lateral).',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Get out of jail free.',
    },
  },
  {
    slug: 'pendulum',
    name: 'Pendulum',
    type: 'BOOST',
    description: 'Putt with your eyes closed. If you sink any putt, subtract 2.',
    effect: {
      scoring: { mode: 'manual', modifier: -2, conditionalKey: 'blind_putt' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'See no evil.',
    },
  },
  {
    slug: 'beer-bonus',
    name: 'Beer Bonus',
    type: 'BOOST',
    description: 'Subtract 1 for each beer you finish on this hole, max -3.',
    effect: {
      scoring: { mode: 'manual', modifier: -1, conditionalKey: 'beers_finished', cap: -3 },
      duration: 1,
      requiresTarget: false,
      input: { type: 'number_input', label: 'How many beers did you finish?', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Hydrate aggressively.',
    },
  },
  {
    slug: 'liquid-lunch',
    name: 'Liquid Lunch',
    type: 'BOOST',
    description: 'Take a shot or start/finish your drink at the tee. If you make bogey or better, subtract 2.',
    effect: {
      scoring: { mode: 'manual', modifier: -2, conditionalKey: 'shot_at_tee_par' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Fuel for the fire.',
    },
  },
  {
    slug: 'big-brother',
    name: 'Big Brother',
    type: 'BOOST',
    description: 'Choose a partner. If you score lower than them on this hole, subtract 2.',
    effect: {
      scoring: { mode: 'manual', modifier: -2, conditionalKey: 'beat_partner' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Sibling rivalry.',
    },
  },
  {
    slug: 'twinning',
    name: 'Twinning',
    type: 'BOOST',
    description: 'Choose a partner. If you both score the same, both subtract 1.',
    effect: {
      scoring: { mode: 'manual', modifier: -1, conditionalKey: 'same_score_partner' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Match made in heaven.',
    },
  },
  {
    slug: 'showdown',
    name: 'Showdown',
    type: 'BOOST',
    description: 'Choose a partner. Outdrive AND beat them on this hole — subtract 2.',
    effect: {
      scoring: { mode: 'manual', modifier: -2, conditionalKey: 'outdrive_and_beat' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Best me if you can.',
    },
  },
  {
    slug: 'caddys-pick',
    name: 'Caddy\'s Pick',
    type: 'BOOST',
    description: 'Have a partner pick the club you must use for your tee shot on your next hole. If you make par or better, subtract 1.',
    effect: {
      scoring: { mode: 'manual', modifier: -1, conditionalKey: 'caddy_pick_par' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Trust the bagman.',
    },
  },
  {
    slug: 'the-streaker',
    name: 'The Streaker',
    type: 'BOOST',
    description: 'Declare how many consecutive greens-in-regulation you\'ll hit. Hit them all → subtract that number from your gross. Miss one → fails.',
    effect: {
      scoring: { mode: 'variable', modifier: null, conditionalKey: 'consecutive_gir' },
      duration: -1,
      requiresTarget: false,
      input: { type: 'number_input', label: 'How many consecutive GIR will you hit?', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Dart thrower for days.',
    },
  },
  {
    slug: 'no-three-putts',
    name: 'No Three-Putts',
    type: 'BOOST',
    description: 'Declare a number of consecutive holes (2-9) without three-putting. Success → subtract 1 per hole. One three-putt → fails.',
    effect: {
      scoring: { mode: 'variable', modifier: null, conditionalKey: 'no_three_putt_streak' },
      duration: -1,
      requiresTarget: false,
      input: { type: 'number_input', label: 'How many holes without three-putting?', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Roll it true.',
    },
  },
  {
    slug: 'birdie-hunter',
    name: 'Birdie Hunter',
    type: 'BOOST',
    description: 'For the next 3 holes, every birdie counts double — subtract an additional 1 per birdie.',
    effect: {
      scoring: { mode: 'windowed', modifier: -1, conditionalKey: 'birdie_bonus', bank: 'sum' },
      duration: 3,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'On the prowl.',
    },
  },
  {
    slug: 'stayin-alive',
    name: 'Stayin\' Alive',
    type: 'BOOST',
    description: 'Avoid all bogeys for the next 3 holes. Success: subtract 3. One bogey or worse: nothing.',
    effect: {
      scoring: { mode: 'windowed', modifier: -1, conditionalKey: 'bogey_free', bank: 'streak' },
      duration: 3,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Don\'t trip.',
    },
  },

  // --- NEW ATTACK CARDS (15) ---

  {
    slug: 'double-or-nothing',
    name: 'Double or Nothing',
    type: 'ATTACK',
    description: 'Pick a player. For the next 3 holes, every SCORE counts double (eagles are -4, birdies are -2, bogeys are +2, double-bogeys are +4)',
    effect: {
      scoring: { mode: 'windowed', modifier: 1, conditionalKey: 'score_double', bank: 'sum' },
      duration: 3,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Gambler, are we?',
    },
  },
  {
    slug: 'three-putt-fee',
    name: 'Three-Putt Fee',
    type: 'ATTACK',
    description: 'If your opponent three-putts this hole, add 1 to their score.',
    effect: {
      scoring: { mode: 'manual', modifier: 1, conditionalKey: 'three_putt' },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Pay up.',
    },
  },
  {
    slug: 'snowman',
    name: 'Snowman',
    type: 'ATTACK',
    description: 'If your opponent makes 8 or more on this hole, add an extra 2.',
    effect: {
      scoring: { mode: 'manual', modifier: 2, conditionalKey: 'opponent_eight_plus' },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Frosty greetings.',
    },
  },
  {
    slug: 'out-of-bounds',
    name: 'Out of Bounds',
    type: 'ATTACK',
    description: 'If your opponent goes OB or loses a ball on this hole, +1 per occurrence.',
    effect: {
      scoring: { mode: 'manual', modifier: 1, conditionalKey: 'opponent_ob_count' },
      duration: 1,
      requiresTarget: true,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Goodbye, ball.',
    },
  },
  {
    slug: 'lefty-for-a-minute',
    name: 'Lefty for a Minute',
    type: 'ATTACK',
    description: 'Opponent must hit one shot opposite-handed (their choice which shot).',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Try the other side.',
    },
  },
  {
    slug: 'eyes-wide-shut',
    name: 'Eyes Wide Shut',
    type: 'ATTACK',
    description: 'Opponent must take their tee shot with eyes closed. Use a spotter for safety. Stanley Kubrick was killed for what he knew.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Trust the swing.',
    },
  },
  {
    slug: 'no-practice-swings',
    name: 'No Practice Swings',
    type: 'ATTACK',
    description: 'Opponent gets zero practice swings on this hole.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Just send it.',
    },
  },
  {
    slug: 'tee-time-attack',
    name: 'Tee Time',
    type: 'ATTACK',
    description: 'Opponent must wait 60 seconds standing over the ball before every shot this hole.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Take all the time.',
    },
  },
  {
    slug: 'the-heckle',
    name: 'The Heckle',
    type: 'ATTACK',
    description: 'You may talk during opponent\'s swings on this hole. Once per shot.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Mind games.',
    },
  },
  {
    slug: 'distance-denied',
    name: 'Distance Denied',
    type: 'ATTACK',
    description: 'Opponent cannot use rangefinder, GPS, or distance markers on this hole.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Eyeball it.',
    },
  },
  {
    slug: 'sing-it',
    name: 'Sing It',
    type: 'ATTACK',
    description: 'Opponent must hum or sing audibly during every backswing on this hole.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Sing for your supper.',
    },
  },
  {
    slug: 'wood-only',
    name: 'Wood Only',
    type: 'ATTACK',
    description: 'Opponent may only use woods (driver, 3W, 5W) for full swings on this hole. Putter still allowed on green.',
    effect: {
      scoring: { mode: 'behavioral', modifier: null, conditionalKey: null },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Select opponent', count: null },
      restrictions: { excludePar3: true },
      flavorText: 'Lumberjack mode.',
    },
  },
  {
    slug: 'the-cursed-club',
    name: 'The Cursed Club',
    type: 'ATTACK',
    description: "Pick a club mentally — don't tell your opponent. Each time they use it on this hole, add 1 to their score.",
    effect: {
      scoring: { mode: 'manual', modifier: 1, conditionalKey: 'cursed_club_uses' },
      duration: 1,
      requiresTarget: true,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Bad mojo.',
    },
  },
  {
    slug: 'yipsy-daisy',
    name: 'Yipsy Daisy',
    type: 'ATTACK',
    description: 'Opponent misses any putt inside 5 feet on this hole, add 1 per miss.',
    effect: {
      scoring: { mode: 'manual', modifier: 1, conditionalKey: 'short_putt_misses' },
      duration: 1,
      requiresTarget: true,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'The yips strike.',
    },
  },
  {
    slug: 'the-flop',
    name: 'The Flop',
    type: 'ATTACK',
    description: '+1 for each of opponent\'s shots from the rough on this hole, max +3.',
    effect: {
      scoring: { mode: 'manual', modifier: 1, conditionalKey: 'rough_shots', cap: 3 },
      duration: 1,
      requiresTarget: true,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Stay in the short stuff.',
    },
  },
  // ─── WINDOWED + DYNAMIC CARDS (10) ─────────────────────────────────────────
  //
  // These run on the generic windowed engine: `duration` holes, a per-hole rule
  // named by `conditionalKey` (see HOLE_PREDICATES in
  // src/lib/variable-powerup-evaluator.ts) and `bank` deciding how per-hole
  // results accumulate. No per-card code.

  {
    slug: 'covid-birdie',
    name: 'COVID Birdie',
    type: 'BOOST',
    description: 'For the next 6 holes, any putt that touches the hole or the flagstick counts as holed. Rattle out, lip out, hit the pin — it is in.',
    effect: {
      scoring: { mode: 'windowed', modifier: 0, conditionalKey: 'none', bank: 'none' },
      duration: 6,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Close enough counts now.',
    },
  },
  {
    slug: 'par-train',
    name: 'Par Train',
    type: 'BOOST',
    description: 'For the next 5 holes, bank -1 for every par or better. A double bogey derails the train and you lose the lot.',
    effect: {
      scoring: { mode: 'windowed', modifier: -1, conditionalKey: 'par_or_better', bank: 'wipe' },
      duration: 5,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'All aboard. Mind the gap.',
    },
  },
  {
    slug: 'the-hot-hand',
    name: 'The Hot Hand',
    type: 'BOOST',
    description: 'For the next 6 holes, every hole you score better than your last one pays -1 and adds another hole to the run. Keep improving, keep going.',
    effect: {
      scoring: { mode: 'windowed', modifier: -1, conditionalKey: 'beat_previous_hole', bank: 'sum' },
      duration: 6,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Do not look down.',
    },
  },
  {
    slug: 'second-wind',
    name: 'Second Wind',
    type: 'BOOST',
    description: 'Only playable once you are 5 or more over par for the round. For the next 9 holes every bogey is wiped back to a par. Doubles still hurt.',
    effect: {
      scoring: { mode: 'windowed', modifier: -1, conditionalKey: 'bogey_rescue', bank: 'sum' },
      duration: 9,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false, minStrokesOverPar: 5 },
      flavorText: 'The round is not over yet.',
    },
  },
  {
    slug: 'fairway-metronome',
    name: 'Fairway Metronome',
    type: 'BOOST',
    description: 'For the next 6 holes, subtract 1 for every fairway you hit. Par 3s are skipped, not counted against you.',
    effect: {
      scoring: { mode: 'windowed', modifier: -1, conditionalKey: 'fairway_bonus', bank: 'sum' },
      duration: 6,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Tick. Tock.',
    },
  },
  {
    slug: 'sandbaggers-bluff',
    name: "Sandbagger's Bluff",
    type: 'BOOST',
    description: 'Call your score on this hole before you tee off. Nail it exactly: -3. Miss by one: nothing. Miss by two or more: +2.',
    effect: {
      scoring: { mode: 'windowed', modifier: -3, conditionalKey: 'exact_call', bank: 'sum' },
      duration: 1,
      requiresTarget: false,
      input: { type: 'number_input', label: 'What will you score on this hole?', count: null },
      restrictions: { excludePar3: false },
      flavorText: 'Say it out loud so everyone hears.',
    },
  },
  {
    slug: 'the-vampire',
    name: 'The Vampire',
    type: 'ATTACK',
    description: 'Pick a player. For the next 4 holes, every stroke they take over par is added to their score AND subtracted from yours.',
    effect: {
      scoring: { mode: 'windowed', modifier: 1, conditionalKey: 'over_par_drain', bank: 'sum', mirror: true },
      duration: 4,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Who are you draining?', count: 1 },
      restrictions: { excludePar3: false },
      flavorText: 'Their bad round is your good one.',
    },
  },
  {
    slug: 'tax-collector',
    name: 'Tax Collector',
    type: 'ATTACK',
    description: 'Pick a player. For the next 6 holes they pay 1 stroke for every birdie or better they make, and you collect it.',
    effect: {
      scoring: { mode: 'windowed', modifier: 1, conditionalKey: 'birdie_tax', bank: 'sum', mirror: true },
      duration: 6,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Who is being taxed?', count: 1 },
      restrictions: { excludePar3: false },
      flavorText: 'Nothing is certain but this.',
    },
  },
  {
    slug: 'the-gauntlet',
    name: 'The Gauntlet',
    type: 'ATTACK',
    description: 'Pick a player and one restriction. They play under it for the next 3 holes.',
    effect: {
      scoring: { mode: 'windowed', modifier: 0, conditionalKey: 'none', bank: 'none' },
      duration: 3,
      requiresTarget: true,
      input: {
        type: 'restriction_select',
        label: 'Which restriction?',
        count: 1,
        options: [
          'No practice swings',
          'Sing or hum audibly through every backswing',
          'Stand over the ball for 60 seconds before every shot',
          'No rangefinder, GPS or distance markers',
          'Eyes closed on every tee shot (use a spotter)',
        ],
      },
      restrictions: { excludePar3: false },
      flavorText: 'Choose their suffering.',
    },
  },
  {
    slug: 'the-tally',
    name: 'The Tally',
    type: 'ATTACK',
    description: 'Pick a player and one sin, without telling them which. Each time they commit it this hole, add 1 to their score, up to +3. They only find out what you were counting once the hole is done.',
    effect: {
      scoring: { mode: 'manual', modifier: 1, conditionalKey: 'tally_count', cap: 3 },
      duration: 1,
      requiresTarget: true,
      input: {
        type: 'restriction_select',
        label: 'Which sin are you counting?',
        count: 1,
        options: [
          'Ball touches the fairway',
          'Shot played from the rough',
          'Ball lands within two club lengths of a bunker',
          'Missed putt from inside 5 feet',
          'Out of bounds or lost ball',
        ],
      },
      restrictions: { excludePar3: false },
      flavorText: 'They will not know what you are counting.',
    },
  },
  // ─── REACTIVE CARDS (3) ────────────────────────────────────────────────────
  //
  // Played to lie in wait: they go ARMED and do nothing until another player
  // acts, then fire on their own. Arming is never announced — the bluff is the
  // mechanic. Which trigger each one answers to lives in REACTIONS
  // (src/lib/powerup-reactions.ts), not here.

  {
    slug: 'deflector',
    name: 'Deflector',
    type: 'BOOST',
    description: 'Play it to arm it — nobody is told. The next attack aimed at you is turned around and lands on whoever sent it.',
    effect: {
      scoring: { mode: 'reactive', modifier: 0, conditionalKey: null, reaction: 'deflect' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Return to sender.',
    },
  },
  {
    slug: 'absorb',
    name: 'Absorb',
    type: 'BOOST',
    description: 'Play it to arm it. The next attack aimed at you does nothing at all, and you take -1 for the trouble.',
    effect: {
      scoring: { mode: 'reactive', modifier: 0, conditionalKey: null, reaction: 'absorb' },
      duration: 1,
      requiresTarget: false,
      input: null,
      restrictions: { excludePar3: false },
      flavorText: 'Thanks for that.',
    },
  },
  {
    slug: 'tripwire',
    name: 'Tripwire',
    type: 'ATTACK',
    description: 'Arm it on a rival, secretly. The next time they attack anyone, they take +2 for the privilege. Their attack still lands.',
    effect: {
      scoring: { mode: 'reactive', modifier: 0, conditionalKey: null, reaction: 'tripwire' },
      duration: 1,
      requiresTarget: true,
      input: { type: 'player_select', label: 'Who are you wiring up?', count: 1 },
      restrictions: { excludePar3: false },
      flavorText: 'Mind your step.',
    },
  },
]

/**
 * Cards retired as near-duplicates, each mapped to the card that absorbed it.
 *
 * Retired, not deleted: PlayerPowerup, DraftPick and PowerupFavorite reference
 * Powerup by foreign key, so deleting one would erase it from the history of
 * every tournament that already played it. A retired card is filtered out of
 * new tournament pools (see tournaments/new/actions.ts) and therefore out of
 * the draft and the browse grid; events already holding it are unaffected.
 *
 * The seed owns this list so it stays declarative and idempotent — rerunning
 * the seed re-applies it, and removing a slug from here un-retires that card.
 */
const RETIRED: Array<{ slug: string; absorbedBy: string; why: string }> = [
  { slug: 'drop-zone', absorbedBy: 'brush-it-off', why: 'identical text: one club length, no penalty' },
  { slug: 'skipping-stones', absorbedBy: 'the-dropdown', why: 'the-dropdown covers any hazard, not just water' },
  { slug: 'the-re-do', absorbedBy: 'mulligan', why: 'mulligan re-hits any shot AND pays -1' },
  { slug: 'sand-save', absorbedBy: 'up-and-down-artist', why: 'same -3; a sand save is an up-and-down from a bunker' },
  { slug: 'showdown', absorbedBy: 'big-brother', why: 'both are "beat your chosen partner"' },
  // Also closes an exploit: shots-for-shots declares no `cap`, so
  // computeActivationModifier bounded it only at NUMBER_INPUT_MAX (20) —
  // one card could post -20 strokes. beer-bonus caps at -3.
  { slug: 'shots-for-shots', absorbedBy: 'beer-bonus', why: 'same card, and the uncapped one' },
  // Seven behavioral attacks that differed only in flavour text — none had any
  // mechanical effect. The Gauntlet does all of them from one menu.
  { slug: 'sing-it', absorbedBy: 'the-gauntlet', why: 'one of five identical behavioral annoyances' },
  { slug: 'the-heckle', absorbedBy: 'the-gauntlet', why: 'one of five identical behavioral annoyances' },
  { slug: 'no-practice-swings', absorbedBy: 'the-gauntlet', why: 'one of five identical behavioral annoyances' },
  { slug: 'tee-time-attack', absorbedBy: 'the-gauntlet', why: 'one of five identical behavioral annoyances' },
  { slug: 'distance-denied', absorbedBy: 'the-gauntlet', why: 'one of five identical behavioral annoyances' },
  // Four "+1 per occurrence, victim self-reports" attacks with one mechanic.
  { slug: 'the-fairway-is-lava', absorbedBy: 'the-tally', why: 'one of four identical count attacks' },
  { slug: 'proximity-mine', absorbedBy: 'the-tally', why: 'one of four identical count attacks' },
  { slug: 'the-cursed-club', absorbedBy: 'the-tally', why: 'one of four identical count attacks' },
  { slug: 'yipsy-daisy', absorbedBy: 'the-tally', why: 'one of four identical count attacks' },
]

async function main() {
  console.log('Seeding powerup cards...\n')

  for (const p of POWERUPS) {
    // Validate against the engine's own schema before writing. A malformed
    // effect would otherwise sit in the database until a player activated it.
    powerupEffectSchema.parse(p.effect)

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

  // ── Apply retirements. Every surviving card is explicitly un-retired so the
  // seed is the single source of truth and can reverse a retirement.
  const retiredSlugs = new Set(RETIRED.map((r) => r.slug))
  const missing = RETIRED.filter((r) => !POWERUPS.some((p) => p.slug === r.slug))
  if (missing.length > 0) {
    throw new Error(`RETIRED names slugs that no card defines: ${missing.map((m) => m.slug).join(', ')}`)
  }
  const danglingTargets = RETIRED.filter(
    (r) => !POWERUPS.some((p) => p.slug === r.absorbedBy) || retiredSlugs.has(r.absorbedBy),
  )
  if (danglingTargets.length > 0) {
    throw new Error(
      `RETIRED points at missing or itself-retired cards: ${danglingTargets.map((d) => `${d.slug} -> ${d.absorbedBy}`).join(', ')}`,
    )
  }

  const now = new Date()
  const retired = await prisma.powerup.updateMany({
    where: { slug: { in: [...retiredSlugs] }, retiredAt: null },
    data: { retiredAt: now },
  })
  const restored = await prisma.powerup.updateMany({
    where: { slug: { notIn: [...retiredSlugs] }, retiredAt: { not: null } },
    data: { retiredAt: null },
  })

  console.log(`\nRetired ${retired.count} newly, restored ${restored.count}:`)
  for (const r of RETIRED) {
    console.log(`  ⊘ ${r.slug} → ${r.absorbedBy}  (${r.why})`)
  }

  // ── Sync new cards into pools that have not been drafted or dealt yet.
  // A pool is a snapshot taken at tournament creation, so a card seeded later
  // never reaches an existing event. Started drafts are left alone (adding a
  // card mid-board shifts a live draft), and retired cards are never removed.
  const liveIds = (await prisma.powerup.findMany({ where: { retiredAt: null }, select: { id: true } })).map((p) => p.id)
  const candidates = await prisma.tournament.findMany({
    where: {
      powerupsEnabled: true,
      tournamentPowerups: { some: {} },
      OR: [
        { distributionMode: 'DRAFT', OR: [{ draft: null }, { draft: { status: 'PENDING' } }] },
        { distributionMode: 'RANDOM', players: { none: { playerPowerups: { some: {} } } } },
      ],
    },
    select: {
      id: true,
      draft: { select: { currentRound: true, picks: { select: { tournamentRound: true } } } },
      tournamentPowerups: { select: { powerupId: true } },
    },
  })
  let syncedCards = 0
  let syncedPools = 0
  for (const t of candidates) {
    if (t.draft?.picks.some((pk) => pk.tournamentRound === t.draft!.currentRound)) continue
    const have = new Set(t.tournamentPowerups.map((tp) => tp.powerupId))
    const missing = liveIds.filter((id) => !have.has(id))
    if (missing.length === 0) continue
    const { count } = await prisma.tournamentPowerup.createMany({
      data: missing.map((powerupId) => ({ tournamentId: t.id, powerupId, quantity: 1 })),
      skipDuplicates: true,
    })
    syncedCards += count
    syncedPools++
  }
  console.log(`\nSynced ${syncedCards} cards into ${syncedPools} not-yet-drafted pools.`)

  const live = POWERUPS.filter((p) => !retiredSlugs.has(p.slug))
  const boosts = live.filter((p) => p.type === 'BOOST').length
  const attacks = live.filter((p) => p.type === 'ATTACK').length
  console.log(
    `\nDone. ${POWERUPS.length} cards defined; ${live.length} draftable ` +
    `(${boosts} boosts, ${attacks} attacks), ${retiredSlugs.size} retired.`,
  )
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
