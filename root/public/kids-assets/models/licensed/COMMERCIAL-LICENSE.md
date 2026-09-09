# Commercially licensed 3D assets

**Everything in this folder is commercially licensed and is not covered by
KeyLearn's AGPL licence — the current contents, and anything added later.**

That is the rule for this directory, not a description of a particular set
of files. If a model is placed here, it is because it was bought and may
not be redistributed under the AGPL.

KeyLearn's source code is published under the GNU Affero General Public
License v3 (`LICENSE`, at the root of this repository). The AGPL gives you
broad rights over the **software**. It gives you no rights whatsoever over
the five model files kept here.

| File | Shown in the app as | Role |
|---|---|---|
| `Explorer.glb` | Dave | main character, companion |
| `Explorer6.glb` | Little Drew | main character, companion |
| `Peeli.glb` | Peeli | main character, companion |
| `Robot.glb` | Robot | companion only |
| `Puppy.glb` | Puppy | companion only |

These were bought under a separate commercial licence. They are included in
this repository so that this deployment of KeyLearn can display them, and
for no other purpose.

The table above is the contents as they stand. It is kept honest by a test
rather than by memory: `npm run test:kids-characters` fails if a `.glb`
appears in this folder without being listed in `LICENSED_MODELS` in
`packages/page-kids/lib/world.ts`, or the other way round. Adding a bought
model is therefore two steps — drop it here, add its name there — and
forgetting the second is caught before it ships.

## Why they are in their own folder

So that the boundary is a directory rather than a paragraph somebody has to
notice. If you fork KeyLearn and have no licence of your own for this art,
**delete this entire folder** — that is the whole of what you must remove,
and nothing outside it is affected.

## If you are reusing KeyLearn

You must do one of the following:

1. **Delete this folder**, and remove the characters that point into it —
   the entries in `HERO_CHARACTERS` and `COMPANIONS` in
   `packages/page-kids/lib/KidsPage.tsx`, and the matching names in
   `LICENSED_MODELS` and `playerHeight` in `packages/page-kids/lib/world.ts`.
   The game runs without them: the KayKit heroes and the dinosaur cast are
   under their own separate terms and are unaffected.
2. **Buy your own commercial licence** for equivalent models from the
   original vendor, and put them here under the same file names.

Extracting these files from this repository, or from a running instance
that serves them, and reusing them elsewhere is permitted by neither
licence.

## What is deliberately *not* claimed here

This file makes no statement about the other assets in the sibling folders
(`hero/`, `dino/`, `nature/`, `env/`, `textures/`). Those carry their own
terms — several are free, and at least one set is CC0 — and each should be
checked on its own before being reused. The scope of this notice is exactly
the five files listed above.

## Where this is also stated

- In the app, on the **About** page, immediately after the paragraph that
  explains KeyLearn is open source — because that is the sentence which
  would otherwise leave the wrong impression.
- In `NOTICE` at the root of the repository.
