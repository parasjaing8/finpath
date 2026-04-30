import { CalculationOutput } from '../engine/calculator';
import { Profile, Goals } from '../engine/types';

export interface FinanceQuote {
  text: string;
  author: string;
  book: string;
}

type QuoteTrigger =
  | 'corpusDepletes'
  | 'earlyFire'
  | 'highSipBurden'
  | 'onTrack'
  | 'justStarting'
  | 'halfwayThere'
  | 'compounding'
  | 'discipline'
  | 'inflation'
  | 'riskReturn'
  | 'general';

interface TaggedQuote extends FinanceQuote {
  tags: QuoteTrigger[];
}

const QUOTES: TaggedQuote[] = [
  {
    text: "Wealth is not about having a lot of money; it's about having a lot of options.",
    author: 'Chris Rock',
    book: 'Your Money or Your Life',
    tags: ['general', 'onTrack'],
  },
  {
    text: "The first rule of compounding: never interrupt it unnecessarily.",
    author: 'Charlie Munger',
    book: 'Poor Charlie\'s Almanack',
    tags: ['compounding', 'discipline'],
  },
  {
    text: "Time in the market beats timing the market.",
    author: 'Ken Fisher',
    book: 'The Only Three Questions That Count',
    tags: ['compounding', 'general'],
  },
  {
    text: "Do not save what is left after spending; instead spend what is left after saving.",
    author: 'Warren Buffett',
    book: 'The Snowball: Warren Buffett and the Business of Life',
    tags: ['discipline', 'highSipBurden', 'justStarting'],
  },
  {
    text: "Financial freedom is available to those who learn about it and work for it.",
    author: 'Robert Kiyosaki',
    book: 'Rich Dad Poor Dad',
    tags: ['general', 'earlyFire', 'onTrack'],
  },
  {
    text: "The goal isn't more money. The goal is living life on your terms.",
    author: 'Chris Brogan',
    book: 'Your Money or Your Life',
    tags: ['earlyFire', 'onTrack', 'halfwayThere'],
  },
  {
    text: "An investment in knowledge pays the best interest.",
    author: 'Benjamin Franklin',
    book: 'The Way to Wealth',
    tags: ['general', 'justStarting'],
  },
  {
    text: "The stock market is a device to transfer money from the impatient to the patient.",
    author: 'Warren Buffett',
    book: 'The Snowball: Warren Buffett and the Business of Life',
    tags: ['discipline', 'compounding'],
  },
  {
    text: "Wide diversification is only required when investors do not understand what they are doing.",
    author: 'Warren Buffett',
    book: 'The Intelligent Investor',
    tags: ['riskReturn', 'general'],
  },
  {
    text: "A part of all you earn is yours to keep.",
    author: 'George S. Clason',
    book: 'The Richest Man in Babylon',
    tags: ['discipline', 'justStarting', 'highSipBurden'],
  },
  {
    text: "The individual investor should act consistently as an investor and not as a speculator.",
    author: 'Benjamin Graham',
    book: 'The Intelligent Investor',
    tags: ['discipline', 'riskReturn'],
  },
  {
    text: "Beware of little expenses. A small leak will sink a great ship.",
    author: 'Benjamin Franklin',
    book: 'The Way to Wealth',
    tags: ['discipline', 'highSipBurden', 'corpusDepletes'],
  },
  {
    text: "Never depend on a single income. Make investment to create a second source.",
    author: 'Warren Buffett',
    book: 'The Snowball: Warren Buffett and the Business of Life',
    tags: ['general', 'corpusDepletes', 'highSipBurden'],
  },
  {
    text: "Compound interest is the eighth wonder of the world. He who understands it, earns it; he who doesn't, pays it.",
    author: 'Albert Einstein',
    book: 'The Psychology of Money',
    tags: ['compounding', 'justStarting'],
  },
  {
    text: "The best investment you can make is in yourself.",
    author: 'Warren Buffett',
    book: 'The Snowball: Warren Buffett and the Business of Life',
    tags: ['general', 'justStarting'],
  },
  {
    text: "Money is a tool. Used properly it makes something beautiful; used wrong, it makes a mess.",
    author: 'Bradley Vinson',
    book: 'Your Money or Your Life',
    tags: ['general', 'discipline'],
  },
  {
    text: "It's not how much money you make, but how much money you keep, how hard it works for you.",
    author: 'Robert Kiyosaki',
    book: 'Rich Dad Poor Dad',
    tags: ['compounding', 'onTrack', 'halfwayThere'],
  },
  {
    text: "Invest in yourself. Your career is the engine of your wealth.",
    author: 'Paul Clitheroe',
    book: 'Money: Master the Game',
    tags: ['general', 'justStarting'],
  },
  {
    text: "The biggest risk is not taking any risk. In a world that's changing quickly, the only strategy guaranteed to fail is not taking risks.",
    author: 'Mark Zuckerberg',
    book: 'The Psychology of Money',
    tags: ['riskReturn', 'justStarting'],
  },
  {
    text: "In investing, what is comfortable is rarely profitable.",
    author: 'Robert Arnott',
    book: 'A Random Walk Down Wall Street',
    tags: ['riskReturn', 'discipline'],
  },
  {
    text: "The four most dangerous words in investing are: 'This time it's different.'",
    author: 'Sir John Templeton',
    book: 'The Psychology of Money',
    tags: ['discipline', 'riskReturn'],
  },
  {
    text: "Know what you own, and know why you own it.",
    author: 'Peter Lynch',
    book: 'One Up on Wall Street',
    tags: ['general', 'discipline'],
  },
  {
    text: "I will tell you how to become rich. Close the doors. Be fearful when others are greedy. Be greedy when others are fearful.",
    author: 'Warren Buffett',
    book: 'The Intelligent Investor',
    tags: ['riskReturn', 'discipline'],
  },
  {
    text: "Inflation is taxation without legislation.",
    author: 'Milton Friedman',
    book: 'A Random Walk Down Wall Street',
    tags: ['inflation', 'general'],
  },
  {
    text: "The most powerful force in the universe is compound interest.",
    author: 'Albert Einstein',
    book: 'The Little Book of Common Sense Investing',
    tags: ['compounding', 'onTrack'],
  },
  {
    text: "Spend less than you earn, invest the rest, and be patient. This is not rocket science.",
    author: 'J.L. Collins',
    book: 'The Simple Path to Wealth',
    tags: ['discipline', 'general', 'highSipBurden'],
  },
  {
    text: "The goal of retirement is to live off your assets — not to be a burden on others or a slave to your portfolio.",
    author: 'Vicki Robin',
    book: 'Your Money or Your Life',
    tags: ['general', 'onTrack', 'earlyFire'],
  },
  {
    text: "If you don't find a way to make money while you sleep, you will work until you die.",
    author: 'Warren Buffett',
    book: 'The Snowball: Warren Buffett and the Business of Life',
    tags: ['earlyFire', 'compounding', 'halfwayThere'],
  },
  {
    text: "Financial independence is the ability to live from the income of your own personal resources.",
    author: 'Jim Rohn',
    book: 'Money: Master the Game',
    tags: ['earlyFire', 'onTrack'],
  },
  {
    text: "The pain of discipline is far less than the pain of regret.",
    author: 'Jim Rohn',
    book: 'Money: Master the Game',
    tags: ['discipline', 'highSipBurden', 'corpusDepletes'],
  },
  {
    text: "Risk comes from not knowing what you're doing.",
    author: 'Warren Buffett',
    book: 'The Intelligent Investor',
    tags: ['riskReturn', 'general'],
  },
  {
    text: "Saving is not enough. You need your money to work for you.",
    author: 'John C. Bogle',
    book: 'The Little Book of Common Sense Investing',
    tags: ['compounding', 'justStarting'],
  },
  {
    text: "The secret of getting ahead is getting started.",
    author: 'Mark Twain',
    book: 'I Will Teach You to Be Rich',
    tags: ['justStarting', 'discipline'],
  },
  {
    text: "Buy not on optimism, but on arithmetic.",
    author: 'Benjamin Graham',
    book: 'The Intelligent Investor',
    tags: ['discipline', 'riskReturn'],
  },
  {
    text: "The single greatest edge an investor can have is a long-term orientation.",
    author: 'Seth Klarman',
    book: 'Margin of Safety',
    tags: ['compounding', 'discipline'],
  },
];

function getTriggers(
  calc: CalculationOutput,
  profile: Profile,
  goals: Goals,
): Set<QuoteTrigger> {
  const triggers = new Set<QuoteTrigger>(['general']);
  const income = profile.monthly_income ?? 0;
  const progress = calc.fireCorpus > 0 ? calc.totalNetWorth / calc.fireCorpus : 0;

  if (calc.failureAge > 0) triggers.add('corpusDepletes');
  if (
    calc.fireAchievedAge > 0 &&
    calc.fireAchievedAge < goals.retirement_age - 3
  ) triggers.add('earlyFire');
  if (
    income > 0 &&
    calc.requiredMonthlySIP / income > 0.45
  ) triggers.add('highSipBurden');
  if (calc.isOnTrack && !calc.failureAge) triggers.add('onTrack');
  if (progress < 0.08) triggers.add('justStarting');
  if (progress >= 0.4 && progress < 0.85) triggers.add('halfwayThere');

  // Always include general themes
  triggers.add('compounding');
  triggers.add('discipline');
  triggers.add('inflation');

  return triggers;
}

export function getContextualQuote(
  calc: CalculationOutput,
  profile: Profile,
  goals: Goals,
  seed?: number,
): FinanceQuote {
  const triggers = getTriggers(calc, profile, goals);

  // Priority: specific triggers first, then general
  const priority: QuoteTrigger[] = [
    'corpusDepletes',
    'highSipBurden',
    'earlyFire',
    'halfwayThere',
    'onTrack',
    'justStarting',
    'compounding',
    'discipline',
    'inflation',
    'riskReturn',
    'general',
  ];

  const priorityTrigger = priority.find(t => triggers.has(t));
  const candidates = QUOTES.filter(q => q.tags.includes(priorityTrigger ?? 'general'));
  const pool = candidates.length > 0 ? candidates : QUOTES;

  // Deterministic pick based on day + seed so it changes daily
  const dayIndex = Math.floor(Date.now() / 86400000);
  const idx = (dayIndex + (seed ?? 0)) % pool.length;
  const { tags: _, ...quote } = pool[idx];
  return quote;
}
