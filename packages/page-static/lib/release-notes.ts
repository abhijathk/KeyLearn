export type ReleaseNote = {
  readonly version: string;
  /** ISO 8601 with time — shown localized in the release notes dialog. */
  readonly date: string;
  readonly changes: readonly string[];
};

// Newest first — prepend new entries here. CHANGELOG.md at the repo root is
// the source document and records everything; THIS list is the customer's
// half of it — the features they can use and the bugs they would have
// noticed, in their words. Internal work belongs in the changelog and not
// here, so the two are kept in step rather than identical. Kept as
// plain English rather than react-intl catalog entries deliberately: this is
// fast-moving internal changelog copy, not the app's core translated
// surface, and 54-locale translation churn on every release isn't worth it.
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    version: "02.00.00",
    date: "2026-10-03T11:49:00Z",
    changes: [
      "Time Keepers, a new world in the kids game.",
      "Hero Trail and Dino Run have new characters and new places to explore.",
      "Classic practice is now in Play in the kids settings, for ages 9 to 13.",
      "The kids games open faster after your first visit.",
      "Time Keepers' characters, artwork, sounds and logo are sold under a commercial licence and are not covered by the AGPL. Hero Trail and Dino Run are AGPL-licensed like the rest of KeyLearn.",
      "Your app language now follows your account to every device, and every learner's settings sync, including changes made offline.",
      "A grown-up PIN is asked for before a child's profile switches to a grown-up's.",
      "Reminder emails follow the choices you make in Preferences.",
      "Guests can export their children's practice, and you can import a KeyLearn export, including kid profiles.",
      "Multiplayer shows speed in words per minute.",
      "Better for screen readers: every switch, picker, progress bar and the typing box are named, and the chosen option is announced.",
      "The default themes now meet the WCAG AA contrast standard for text.",
      "Passkeys: if you cancel the prompt you get a plain explanation instead of a browser error.",
      "The rest of the interface is translated into all 54 languages.",
      "Fixed: the keystroke that ends a typing test no longer throws away the result.",
      "Fixed: exporting your account failed for everyone.",
      "Fixed: the keyboard could stop responding after a new letter was unlocked, until the page was reloaded.",
      "You can now message us from inside KeyLearn. Open your account and go to Support: write to us, see our replies in one place, attach a screenshot, and tell us if a reply helped. Only a grown-up profile can write to us.",
      "A help centre with answers to the questions we get most, so you can often find the answer straight away.",
      "The bell in the top corner now tells you when we reply, or when something changes on a conversation you started.",
      "Every learner can have their own reading voice. The voices are real and sound the same on every device — pick one for each learner and give it a name.",
      "Your settings now follow you. Voice, theme, text size and accessibility settings move with the learner between devices instead of staying on one computer.",
      "Five keyboards to practise on, in Settings: KeyLearn, Flat Silver, Flat Midnight, Mechanical with its tall sculpted keys and per-key lighting, and Round with its circular caps and six colours to choose from.",
      "A new look for the kids keyboard, Rainbow: a green frame, red numbers, blue letters and the vowels a lighter blue, with pictures instead of words on keys like enter and shift — so it works before a child can read.",
      "Text size now makes everything bigger, not just the writing, and there are five sizes to choose from instead of three.",
      "Each learner gets a face and a voice from the start, so a new profile is ready to use without setting anything up.",
      "The kids world now works with a screen reader: it says there is a world, and where in it you are, instead of leaving the picture silent.",
      "KeyLearn is now fully translated into all 54 languages, including everything new.",
      "Setting up two-step sign-in is simpler — it opens straight on the QR code.",
      "Files you attach when you write to us are checked for viruses before we keep them.",
      "Fixed: signing up could fail partway through and leave you without an account.",
      "Fixed: on some Mac keyboards, one key never lit up when you pressed it.",
      "Fixed: the kids world used more and more memory the longer it was open, which slowly made it stutter.",
      "Fixed: changing a learner's reading voice sometimes kept the old one for a while.",
      "Fixed: signed-out visitors were shown keyboard colours only account holders can use.",
      "Fixed: on a phone or another narrow screen you now get a clear message instead of a broken layout.",
    ],
  },
  {
    version: "01.03.00",
    date: "2026-08-15T09:05:00Z",
    changes: [
      "KeyLearn needs a real keyboard and enough width for the practice text and keyboard side by side, so it now shows a clear “made for a bigger screen” message on phones and other narrow screens instead of a broken layout.",
    ],
  },
  {
    version: "01.02.00",
    date: "2026-08-15T06:40:52Z",
    changes: [
      "Added a contact card to the About page's Version section — support@keylearn.org now actually receives mail, so it's easy to find.",
      "Redesigned the “Create a free account” prompt with a real banner image, in both light and dark versions, replacing the plain wordmark header.",
      "support@keylearn.org can now receive mail — it previously bounced everything sent to it.",
    ],
  },
  {
    version: "01.01.01",
    date: "2026-08-15T01:38:00Z",
    changes: [
      "The alphabet-progress grid on the practice recap card could grow taller than its neighbours for scripts with 50+ letters. It now keeps a fixed height and shrinks the tiles instead.",
      "The full-screen loading indicator shown while a page loads faded in too slowly to ever fully appear for shorter waits, so page changes with a slight delay showed nothing at all. It now reaches full visibility sooner.",
    ],
  },
  {
    version: "01.01.00",
    date: "2026-08-15T00:21:00Z",
    changes: [
      "Added a brief note explaining why to support KeyLearn before the coffee link opens Buy Me a Coffee, and moved that link to the About page.",
      "Fixed two-step verification setup, which never actually showed a scannable QR code.",
      "Fixed profile pictures and names not updating correctly when signing in with a different linked provider (e.g. Facebook after Google).",
      "Fixed the About page crediting itself as its own origin instead of the real one, keybr.",
      "Faster page loads: the kids page's graphics no longer load on every page, and the User Guide's 54 languages now load one at a time instead of all together.",
    ],
  },
  {
    version: "01.00.00",
    date: "2026-08-14T00:00:00Z",
    changes: ["First public release."],
  },
];
