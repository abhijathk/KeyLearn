# AK 3D Pack — a commercially licensed KeyLearn product

**Everything in this folder belongs to the AK 3D Pack. It is licensed
commercially and is NOT covered by KeyLearn's AGPL licence** — the assets
listed below, and anything added to this folder later.

That is the rule for this directory, not a description of a particular set
of files. An asset placed here is part of the pack and is not released
under the AGPL.

KeyLearn's source code is published under the GNU Affero General Public
License v3 (`LICENSE`, at the root of this repository). The AGPL gives you
broad rights over the **software**. It gives you no rights over the pack.

The pack is our own work, not a third-party asset we redistribute. It is
in this repository because this deployment of KeyLearn uses it, and it is
kept in one folder so that the line between what is free and what is not
is a directory rather than a paragraph.

**Want to use it?** It is for sale. Contact KeyLearn support for pricing —
`/support` on the site, or the support link on the About page. There is no
need to strip it out and find something else if you would rather license
the real thing.

The folder is named `ak-3d-pack` rather than "AK 3D PACK" because it is
also a URL path — every model is fetched from it by the browser, and a
space would arrive as `%20` in each request.

## What is in the pack

<!-- INVENTORY:START -->

| File | Shown in the app as | Role | Size | Triangles | Joints | Animations |
|---|---|---|---|---|---|---|
| `Explorer.glb` | Dave | Main character or companion | 3.95 MB | 17,650 | 24 | 20 |
| `Explorer6.glb` | Little Drew | Main character or companion | 2.81 MB | 18,035 | 28 | 21 |
| `Peeli.glb` | Peeli | Main character or companion | 3.69 MB | 23,063 | 28 | 21 |
| `Puppy.glb` | Puppy | Companion only | 1.69 MB | 27,034 | 27 | 4 |
| `Robot.glb` | Robot | Companion only | 1.00 MB | 8,594 | 28 | 4 |

**5 models, 13.14 MB in total.**

Animation clips, per model:

- **Dave** (`Explorer.glb`) — `Idle`, `Joy_LevelComplete`, `Run`, `Walk`, `Jump`, `Crouch_Down`, `Crouch_Idle`, `Stand_From_Crouch`, `Sit_CrossLegged_Down`, `Sit_CrossLegged_Idle`, `Stand_From_CrossLegged`, `Wave`, `Punch_Right`, `Punch_Left`, `Kick`, `Combo_3Hit`, `Hit_Front`, `Hit_Back`, `Dodge_Left`, `Dodge_Right`
- **Little Drew** (`Explorer6.glb`) — `Idle`, `Joy_LevelComplete`, `Run`, `Walk`, `Jump`, `Crouch_Down`, `Crouch_Idle`, `Stand_From_Crouch`, `Sit_CrossLegged_Down`, `Sit_CrossLegged_Idle`, `Stand_From_CrossLegged`, `Wave`, `Punch_Right`, `Punch_Left`, `Kick`, `Combo_3Hit`, `Hit_Front`, `Hit_Back`, `Dodge_Left`, `Dodge_Right`, `Kung_Fu_Punch`
- **Peeli** (`Peeli.glb`) — `Run_InPlace`, `Walk_InPlace`, `Idle_Calm`, `Wave`, `No_Disagree`, `Joy_Victory`, `Excited`, `MartialArts_Ready`, `Walk_Cute`, `Run_Cute`, `Stand_To_CrossLegged`, `CrossLegged_To_Stand`, `Punch_Combo_4`, `Punch_Combo_5`, `Punch_Forward_BothFists`, `CrossLegged_Idle`, `Forward_Charge_InPlace`, `High_Kick_StepIn`, `Sweeping_Kick`, `Run_Fast_RootMotion`, `RestPose`
- **Puppy** (`Puppy.glb`) — `Walk`, `Idle`, `Tail_Wag`, `Run`
- **Robot** (`Robot.glb`) — `Running`, `Monster_Walk`, `Idle`, `Standing`

<!-- INVENTORY:END -->

The table above is generated from the folder itself by
`node scripts/ak-pack-manifest.mjs` — a licence document listing the wrong
files is worse than one listing none, because it looks authoritative and
is not. Re-run it after adding or replacing an asset.

The list is also kept honest by a test: `npm run test:kids-characters`
fails if a `.glb` appears here without being named in `AK_3D_PACK` in
`packages/page-kids/lib/world.ts`, or the other way round. Adding a pack
model is two steps — drop it here, add its name there — and forgetting the
second is caught before it ships.

## If you are reusing KeyLearn

You must do one of the following:

1. **License the pack.** Contact KeyLearn support for pricing. This is the
   intended route — the pack exists to be licensed, and keeping it means
   the children's game arrives complete.
2. **Delete this entire folder**, and remove the characters that point into
   it — the entries in `HERO_CHARACTERS` and `COMPANIONS` in
   `packages/page-kids/lib/KidsPage.tsx`, and the matching names in
   `AK_3D_PACK` and `playerHeight` in `packages/page-kids/lib/world.ts`.
   The game runs without them: the KayKit heroes and the dinosaur cast are
   under their own separate terms and are unaffected.

What you may not do is keep the files without a licence. Extracting them
from this repository, or from a running instance that serves them, and
reusing them elsewhere is not permitted by the AGPL and is not permitted
by us.

## What is deliberately *not* claimed here

This file makes no statement about the other assets in the sibling folders
(`hero/`, `dino/`, `nature/`, `env/`, `textures/`). Those carry their own
terms — several are free, and at least one set is CC0 — and each should be
checked on its own before being reused. The scope of this notice is exactly
this folder.

## Where this is also stated

- In the app, on the **About** page, immediately after the paragraph that
  explains KeyLearn is open source — because that is the sentence which
  would otherwise leave the wrong impression. It names the pack rather
  than listing its contents; this file is the inventory.
- In `NOTICE` at the root of the repository.
