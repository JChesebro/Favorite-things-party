export const eventInfo = {
  title: 'Glacier Soiree',
  hosts: 'Stephanie and Jeff',
  date: 'December 5, 2026',
  time: '6:30 PM to 10:30 PM',
  location: '1332 Legendary Lane, Morrisville',
  theme: 'Blue ice, gold light, champagne glow',
  note: 'A favorite things tradition celebrating 12 years together with a colder, brighter winter palette.',
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
  'What should everyone try before leaving the party?',
  'What is your favorite cozy winter ritual?',
  'What is your most reliable holiday hosting trick?',
]

export const partyGameIdeas = [
  {
    title: 'Guess the Favorite Thing',
    description: 'Draw one favorite item from the guest board, then have the table guess who brought it before the reveal.',
  },
  {
    title: 'Favorite Things Relay',
    description: 'Each round starts with one guest answer. The next person adds a related favorite thing until the table has built a chain.',
  },
  {
    title: 'Glacier Trivia Vote',
    description: 'Read a prompt and have everyone vote on the best answer. The guest wall shows the final responses afterward.',
  },
]

export const sampleGuestPreview = [
  {
    id: 'preview-1',
    name: 'Preview Guest',
    email: 'preview@example.com',
    plusOnes: 1,
    bringingDish: 'Sparkling cranberry bites',
    favoriteThing: 'Mini candle set',
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
    bringingDish: 'Champagne grapes and brie',
    favoriteThing: 'Gold-rimmed coupes',
    icebreakerAnswer: 'A favorite thing I already own and still love.',
    triviaAnswerOne: 'A clear tray for serving.',
    triviaAnswerTwo: 'Let guests vote with stickers.',
    notes: 'Example layout for the guest board.',
    code: 'PREVIEW-2',
    updatedAt: Date.now() - 60000,
  },
]
