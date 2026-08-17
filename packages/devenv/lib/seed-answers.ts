#!/usr/bin/env -S npx tsnode
// Seeds the support desk's Answers library with real, verified product
// facts (see support-desk-agent/OPERATING-MANUAL.md for how the automation
// agent, Tab, is required to ground every reply in this library). Content
// is sourced directly from shipped UI copy and code, not invented — each
// Answer below traces back to a real component/string checked against the
// repo at authoring time. Idempotent: skips any title that already exists,
// so it is safe to re-run after adding more entries below.

import { Container } from "@fastr/invert";
import { ConfigModule, Env } from "@keylearn/config";
import { Answer, AnswerRule, createSchema } from "@keylearn/database";
import { Logger } from "@keylearn/logger";
import Knex from "knex";

type Seed = {
  readonly title: string;
  readonly body: string;
  readonly rules: readonly string[];
};

const SEEDS: readonly Seed[] = [
  {
    title: "Book Text is English-only",
    body: "Book Text uses real passages from public-domain books, which are only available in English. It's disabled whenever your keyboard practice language isn't English — go to Practice → Settings → Keyboard tab and set Language to English to unlock it. If Book Text was already selected and you then switch your practice language away from English, KeyLearn automatically switches you to Guided practice instead — that's expected, not a bug.",
    rules: [
      "book text,books disabled,can't select book,book text greyed,book text unavailable",
      "book text english only,why is book text disabled",
    ],
  },
  {
    title: "Switching your keyboard layout or practice language",
    body: "Go to Practice → Settings → Keyboard tab. Under Layout, 'Language' sets which language the practice words are drawn from, and 'Keyboard layout' sets where the letters sit on the keys you're learning (e.g. Dvorak, Colemak, QWERTY). Leave 'Simulate this layout' on unless your physical keyboard already remaps itself. This is a per-profile setting — it doesn't affect the site's menu language.",
    rules: [
      "keyboard layout,switch layout,change layout,dvorak,colemak,change keyboard",
      "practice language,typing language,change typing language",
    ],
  },
  {
    title: "Changing the site/app language",
    body: "Go to Account → Preferences → Language & region, and use 'App & email language' — this changes the language of menus, buttons, and the emails KeyLearn sends you. It applies to your whole account, not per learner. This is separate from your keyboard/practice language, which is set per profile in Practice → Settings → Keyboard tab.",
    rules: [
      "site language,app language,change language,menu language,ui language",
      "language and region,app and email language",
    ],
  },
  {
    title: "Adding a learner profile",
    body: "Go to Account → Learners and select 'Add a learner'. Each profile is either Kid or Grown-up, and keeps its own practice progress separately. A household can have multiple profiles, kids and grown-ups in any mix (braille/audio profiles use a separate allowance and don't count against the regular limit). KeyLearn is designed for learners aged 5 and up, and adding a child profile requires ticking a parental-consent checkbox.",
    rules: [
      "add a learner,add profile,new profile,add a family member,multiple learners",
      "how many profiles,household profiles",
    ],
  },
  {
    title: "Switching between learner profiles",
    body: "When a household has more than one profile, KeyLearn shows a 'Who's practising?' picker after sign-in — pick a profile to switch to it for that session. Each profile keeps entirely separate practice progress, settings, and stats.",
    rules: [
      "switch profile,switch learner,change profile,whos practising,who is practicing",
    ],
  },
  {
    title: "Converting a Kid profile to Grown-up",
    body: "A Kid profile can be converted to Grown-up from Account → Learners, and this keeps every certificate, medal, and lesson already earned. It is one-way: once converted, the profile moves permanently to the grown-up pages, and the kids trail and its rewards end — a Grown-up profile can't be converted back to Kid.",
    rules: [
      "convert profile,kid to grown up,change profile type,upgrade profile,turn off kids mode",
    ],
  },
  {
    title: "Is Kids mode safe for my child to use alone?",
    body: "Yes — there's no chat, no strangers, and no way to share personal details. It's a solo typing game. A parent or guardian still needs to create the profile and give consent first, from Account → Learners.",
    rules: ["kids mode safe,is it safe for my child,child safety,kids safe"],
  },
  {
    title: "How Kids mode works",
    body: "A Kid profile automatically gets its own kids-only pages — it can't reach Account or profile-management pages even by direct link. Practice is wrapped in a game with two selectable worlds ('Hero Trail' or 'Dino Run'), tuned by age band, switchable any time from the in-game settings.",
    rules: ["kids mode,dino run,hero trail,kids game,what is kids mode"],
  },
  {
    title: "Enabling braille/vision support for a learner",
    body: "Go to Account → Learners, edit the profile, and turn on 'Vision support'. This switches that learner to the braille page instead of the ordinary one — six-key typing and spoken guidance, with a different curriculum. You can turn it back off later; their practice on each side is kept but only visible while that mode is active (it doesn't merge across).",
    rules: ["braille,vision support,blind,visually impaired,enable braille"],
  },
  {
    title: "How braille typing works in KeyLearn",
    body: "Braille input is six-key chorded entry: F, D, S for the left hand (dots 1-3) and J, K, L for the right hand (dots 4-6), plus Space. Braille progress is tracked in cells rather than words-per-minute, since there's no words-per-minute figure comparable across a braille curriculum.",
    rules: [
      "braille keys,braille typing,how does braille work,six key,dot keys",
    ],
  },
  {
    title: "Hiding your identity on leaderboards",
    body: "Go to Account (click your avatar/name), and turn on 'Hide my identity' — this shows a generated name and picture on leaderboards and in multiplayer instead of your real one.",
    rules: [
      "hide identity,anonymous leaderboard,hide my name,fake name leaderboard",
    ],
  },
  {
    title: "Public profile page",
    body: "Go to Account (click your avatar/name) and use the 'Public profile page' toggle. It's off by default — profile links are guessable, so turning this on makes your typing history visible to anyone with the link.",
    rules: ["public profile,share my profile,profile link,make profile public"],
  },
  {
    title: "Changing your email or password",
    body: "Go to Account → Security → 'Sign-in & security'. 'Change email' takes a new address and confirms it with a 6-digit code. 'Change password' (or 'Set a password' if you don't have one yet) updates or adds a password. If you signed up with Google, Microsoft, or Facebook, there's no separate KeyLearn password — sign in with that provider instead.",
    rules: [
      "change email,change password,forgot password,reset password,set a password",
      "sign in security,update password",
    ],
  },
  {
    title: "Logging out of all other devices",
    body: "On the Account page, there's a 'Log out of all other devices' checkbox next to the Log out button — check it before logging out, and every other phone, tablet, or computer signed in to your account is logged out too. Learner profiles stay on the device they're on either way.",
    rules: [
      "log out other devices,log out everywhere,sign out all devices,logged in elsewhere",
    ],
  },
  {
    title: "Deleting your account",
    body: "Go to Account and use 'Delete account' in the danger section. This permanently erases your name and email from KeyLearn's servers and can't be undone — your learner profiles and their local progress stay on this device (they're not automatically deleted). You're welcome to create a new account later.",
    rules: [
      "delete account,delete my account,close account,remove account,cancel account",
    ],
  },
  {
    title: "Exporting or downloading your data",
    body: "There are two export options: Account → Security → 'Download my data' exports everything the account holds (profiles, practice history, sign-in methods, activity log) as one JSON file. Account → Preferences → 'Privacy & data' has a separate 'Export my data' for per-learner practice history, certificates, and settings.",
    rules: [
      "export my data,download my data,download data,export data,gdpr export",
    ],
  },
  {
    title: "Deleting a single learner's progress",
    body: "Go to Account → Learners, edit the profile you want to remove, and choose Delete. This removes that learner and their practice progress from this device permanently — it doesn't affect any other profile in the household.",
    rules: [
      "delete learner,delete profile,remove learner,delete my child's progress,erase learner",
    ],
  },
  {
    title: "How to earn a KeyLearn certificate",
    body: "A certificate requires clearing a full checklist of real practice evidence — every letter/cell introduced learned and reliably 'settled', enough lessons completed, enough days practised over enough elapsed time, and sustained speed and accuracy — then passing a proctored-style assessment. For adults the bar is 35 words/minute at 95% accuracy (50 cells/minute at 95% for braille); kids are graded on an age-banded Bronze/Silver/Gold scale at 90% accuracy instead. Certificates require a signed-in account, from Account → Course.",
    rules: [
      "certificate,how to earn certificate,get certified,completion certificate,assessment",
      "certificate requirements,pass assessment",
    ],
  },
  {
    title: "Is a KeyLearn certificate an official qualification?",
    body: "No — it's honest evidence of a measured speed and accuracy on a given date, not a qualification any school, exam board, or employer has formally agreed to recognize.",
    rules: [
      "certificate official,is certificate recognized,qualification,certificate valid",
    ],
  },
  {
    title: "What the notification bell is for",
    body: "The bell icon in the header (visible when signed in) currently notifies you of one thing: a reply to your support ticket while you're signed in, in place of an email. Click it to see the message and mark it read.",
    rules: ["notification bell,what is the bell,notification icon,bell icon"],
  },
  {
    title: "Viewing your typing progress and stats",
    body: "Go to the Profile page (top navigation) for a detailed look at your progress over time: best and typical speed, best and typical accuracy, lessons done, time spent, a per-letter mastery view, a per-key speed heatmap, and a practice calendar for the last year.",
    rules: [
      "my progress,my stats,see my speed,see my wpm,typing progress,progress page",
    ],
  },
  {
    title: "Does a missed day break my streak?",
    body: "By default, yes — your streak counts consecutive days with at least one completed lesson. There's an accessibility setting ('A rest day keeps the streak') that can be turned on so a missed day doesn't reset it.",
    rules: ["streak,missed a day,broke my streak,rest day,streak reset"],
  },
  {
    title: "Is KeyLearn actually free?",
    body: "Yes — every lesson, and every learner in your household, with no ads blocking practice. Supporting the project is entirely voluntary.",
    rules: ["is keylearn free,cost,price,free to use,pricing"],
  },
];

Env.probeFilesSync();
const container = new Container();
container.load(new ConfigModule());
const knex = container.get(Knex);

async function exec() {
  try {
    await createSchema(knex);
    const existing = new Set(
      (await Answer.listPublished()).map((a) => a.title),
    );
    let created = 0;
    for (const seed of SEEDS) {
      if (existing.has(seed.title)) {
        continue;
      }
      const answer = await Answer.create({
        title: seed.title,
        body: seed.body,
      });
      for (const keywords of seed.rules) {
        await AnswerRule.create({ answerId: answer.id!, keywords });
      }
      created++;
    }
    Logger.info(
      `Seeded ${created} new Answer(s); ${SEEDS.length - created} already present.`,
    );
  } finally {
    await knex.destroy();
  }
}

exec().catch((err) => {
  console.error(err);
  process.exit(1);
});
