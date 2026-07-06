export const eventInfo = {
  title: 'Glacier Soiree',
  hosts: 'Stephanie and Jeff',
  date: 'December 5, 2026',
  time: '6:30 PM to 10:30 PM',
  location: '1332 Legendary Lane, Morrisville',
  theme: 'Blue ice, gold light, champagne glow',
  note: 'Welcome to an evening of sparkling conversation, cozy favorites, and glacier-lit celebration.',
}

export const giftRules = [
  'Bring 3 identical unwrapped items.',
  'Each item should be about $10.',
  'The three gifts can be a variety pack of the same thing, but should match as a set.',
  'Think: practical, beautiful, tasty, cozy, or delightfully useful.',
]

export const icebreakerPrompts = [
  'What is one favorite thing you discovered this year?',
  'What small purchase made your life better than it should have?',
  'What snack or treat would you happily gift to everyone here?',
  'What is your go-to comfort ritual in winter?',
  'What are you collecting, saving, or overthinking in a good way?',
]

export const triviaPrompts = [
  'If your year had a title, what would it be and why?',
  'What is one small luxury that always makes a day better?',
  'Which favorite thing in your life has the best backstory?',
  'If you could host this party anywhere in the world, where would it be?',
  'What is one tradition you want to start in the next year?',
]

export const partyGameIdeas = [
  {
    title: 'Glacier Table Trivia',
    description: 'Read one thought-provoking prompt and let each table submit one answer. Vote on the most surprising response.',
  },
  {
    title: 'Story Spark Round',
    description: 'Pull one trivia prompt, then each guest gives a 20-second story linked to that prompt.',
  },
  {
    title: 'Golden Vote Finale',
    description: 'Everyone picks their favorite anonymous answer from the board, then reveal the winner at the end.',
  },
]

export const superlativePollPrompts = [
  'Most likely to have five candles glowing at once',
  'Best-dressed favorite thing of the night',
  'Most likely to find the coziest corner in any room',
  'Most likely to bring the perfect hostess touch',
  'Most likely to have the most aesthetic snack plate',
  'Most likely to recommend your next favorite purchase',
  'Most likely to keep a signature scent for every season',
  'Most likely to own the prettiest winter mug collection',
  'Most likely to turn any table into a styled tablescape',
  'Most likely to have the best party playlist save',
]

export const twoTruthsAndFavoritePrompts = [
  'Share two true favorite things you bought this year and one fake one.',
  'Share two true favorite comfort rituals and one fake one.',
  'Share two true favorite kitchen items and one fake one.',
  'Share two true favorite beauty or self-care items and one fake one.',
  'Share two true favorite travel essentials and one fake one.',
  'Share two true favorite home decor finds and one fake one.',
  'Share two true favorite small luxuries and one fake one.',
  'Share two true favorite holiday traditions and one fake one.',
  'Share two true favorite hosting habits and one fake one.',
  'Share two true favorite weekend treats and one fake one.',
]

export const polaroidCaptionContestPrompts = [
  'Caption this as if it were a magazine cover headline.',
  'Caption this with your best winter party one-liner.',
  'Caption this like a movie title from a cozy holiday rom-com.',
  'Caption this as if the photo had its own gossip column.',
  'Caption this with the vibe of a dramatic award show moment.',
  'Caption this with a fake product slogan for the party.',
  'Caption this as if your table started a band tonight.',
  'Caption this like a luxury candle scent description.',
  'Caption this as if it were the final frame of a music video.',
  'Caption this with your most iconic three-word punchline.',
]

export const sampleGuestPreview = [
  {
    id: 'preview-1',
    name: 'Preview Guest',
    email: 'preview@example.com',
    plusOnes: 1,
    icebreakerAnswer: 'A softly lit room and a good blanket.',
    triviaAnswerOne: 'Hot cider bar',
    triviaAnswerTwo: 'A playlist that starts calm and ends dancey.',
    notes: 'Preview card until real RSVPs come in.',
    code: 'PREVIEW-1',
    updatedAt: Date.now(),
  },
  {
    id: 'preview-2',
    name: 'Sample Host',
    email: 'sample@example.com',
    plusOnes: 0,
    icebreakerAnswer: 'A favorite thing I already own and still love.',
    triviaAnswerOne: 'A clear tray for serving.',
    triviaAnswerTwo: 'Let guests vote with stickers.',
    notes: 'Example layout for the guest board.',
    code: 'PREVIEW-2',
    updatedAt: Date.now() - 60000,
  },
]
