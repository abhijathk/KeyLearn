import { type WordList } from "@keylearn/content";
import { type Language } from "@keylearn/keyboard";
import { getBlacklist } from "@keylearn/phonetic-model";

/**
 * Words a child should not be handed to type, from the grown-up English
 * lists (words-en and words-en-GB, 13,526 words between them). Every word was
 * read for a 9–13 year old typing it in isolation: sex and the body, drink,
 * drugs, smoking and gambling, guns and killing, death, upsetting illness,
 * slurs and insults, cruelty and crime. Ordinary words that only sound dark
 * out of context stay in — "battle", "ghost", "poison", "whipped", "sentenced",
 * "army" — because a story for this age uses them.
 *
 * Kids Classic and the trail both type from the children's vocabulary
 * (kids-words.ts); this list is the second layer under it, and the only one
 * if a vocabulary ever falls back to the full list. Matching is whole-word, so "skill" is never caught by "kill".
 */
const UNSAFE_EN: ReadonlySet<string> = new Set(
  `
  abnormal abnormalities abortion abuse addiction addictive alcohol
  ammunition arousal assassin assassination assassins assault assaulted
  asylum attack attacked attacker attackers attacking attacks babe backside
  bartender battered bawdy beaten beating beer beers bikini blackjack blacks
  bled bleed bleeding blindfold blooded bloodied bomb bomber bombers bombs
  booze bowel bowels boyfriend boyfriends brawl brawler breast breasts bulge
  bulging bullet bullets burial burlesque bust butch cancer cancers caress
  caressed caressing casino casualties casualty cemetery champagne cigar
  cigarette cigarettes climax cocktail cocky coffin coke colitis coma
  conjugal convicted convictions crazed crime crimes criminal criminals
  crotch cult daft dagger daggers damned dating dead deadly death deaths
  deceased dementia depressed depression diarrhoea died dies discrimination
  divorce divorced drown drowned drowning drug drugged drugs drunk drunken
  dying ecstasy embryo embryos erect erection erotic escort execute executed
  execution exhume explosive explosives faecal fat fatal fertility firefight
  flirt flirting flog flogging foxy frat frigid frisky funeral gin girlfriend
  girlfriends grave graves graveyard gun gunfire gunner guns gunshot
  gunslinger handcuff handcuffs handicap handicapped hangover harassment hate
  hated hateful hates hating hatred hazing holster honeymoon hostage hostages
  imprisoned imprisonment infectious inflicted injecting inmates intercourse
  intimacy intimate intoxicating jackpot jail jailbreak jailed jailhouse
  jugular kidnapped kidnapping killed killer killers killing knife knives
  lacy lame laxative lethal leukaemia liar liquor loser lovemaking lover
  lovers manslaughter marital massage mating midriff missile missiles
  mistress moan moaned moaning moans mortality murder murdered murderer
  murderous murders naked navel nude objectifies objectify obscene pancreatic
  pawnshop pelvis penal penetrating penetration perverse pistol poisoned
  poker pregnancy pregnant prison prisoner prisoners prisons psycho pub pubs
  punching queer racial rectal revolver rifle rifles romance romantic scotch
  scrawny screwed screwing seduce seductive sensual sexes shoot shooting
  shoots shotgun skinny slap slapped slapping slashed slaughter slave slavery
  slaves smokers smoking stab stabbed stabbing stalked stalking strangled
  stripped stripping stupidity stupidly submissive supremacy swear swearing
  sweepstakes tequila terror thigh thighs throbbed throbbing thrust thrusting
  thrusts tobacco torturing tranquilize tranquilizer tumour tumours ulcer
  ulcers unbuttoned underwear unfaithful unmarried unrequited unzipped
  vampire vampires victim victimization victimize victimized victims
  violation violence violent violently vixen vodka voluptuous vomit voyeur
  vulgarity vulgarize wager war warfare warlord warmonger wars weakling
  weaklings weapon weaponize weapons wench whiskey whisky widow widowmaker
  wine wines womb wound wounded wounds xenophobe xenophobia zombie zombies
  zonked`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Drops unsuitable words, keeping the list's frequency order so the generator
 * weights exactly as before. English uses the reviewed list above; every
 * language also passes through the profanity list the pseudo-word generator
 * already uses, so a real word is held to the same bar as an invented one.
 */
export function filterUnsafeWords(
  wordList: WordList,
  language: Language,
): WordList {
  const profanity = getBlacklist(language);
  return wordList.filter((word) => {
    const lower = language.lowerCase(word);
    return !UNSAFE_EN.has(lower) && profanity.allow(word);
  });
}

/** For tests: is this word on the reviewed English list? */
export function isUnsafeWord(word: string): boolean {
  return UNSAFE_EN.has(word.toLowerCase());
}
