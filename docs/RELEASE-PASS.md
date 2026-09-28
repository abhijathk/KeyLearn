# KeyLearn release pass

End-to-end browser tests of KeyLearn, QDesk and the link between them, on a fresh test stack: sqlite, logged mail, and nginx in front, splitting game sockets the way production does. Branch `claude/cool-albattani-4odtli`, generated 2026-09-28.

| | |
|---|---|
| Feature checks passing | **258 / 265** |
| Open bugs (below) | **1** |
| Fixed during this pass | 34 |
| Critical accessibility issues | 0 |
| Unit-test failures | 0 (72 packages) |
| Languages complete | 54 |

## Bugs outstanding to fix

Found by these tests and **not fixed yet**, most severe first. Each says where to look and what was seen.

### 1. QDesk main is behind the desk that has the fixes

- **Severity:** Medium
- **Where:** `QDesk main (e44a609) vs claude/cool-albattani-4odtli (b64fb5a + 3661a2b)`

Three QDesk checks still fail, and only because main is the old sign-in skeleton: the staff password in the session file, a bare 500 when KeyLearn is down, and cross-site POSTs. The full desk already holds the password in memory (pending-login.ts) and has a cross-site guard (csrf.ts); 3661a2b makes its sign-in answer 503 with a sentence. A push of main to the desk branch was blocked by this session's safety check, so it needs the owner: git push origin origin/claude/cool-albattani-4odtli:main.

### Failing checks behind these bugs

- [ ] **qdesk**: the staff password is not kept in plain text in the session store between steps (found in qdesk-data/sessions/Yr/KHU3QYeJphmeZXud4m qdesk-data/sessions/)
- [ ] **qdesk-stability**: with KeyLearn down, the message is readable (not an internal error dump) ("500 - Internal Server Error")
- [ ] **qdesk**: a cross-site POST is refused (200 (SameSite=Lax cookie still keeps the session out of it))

## Needs the owner

- **QDesk main is behind the full desk**: QDesk main is still at e44a609 (18 Aug): sign-in and a landing page, which is what was tested here. The full desk is 313 commits ahead on claude/cool-albattani-4odtli (b64fb5a) and was never merged. Nothing was deleted; main needs a fast-forward to b64fb5a.
- **The full desk still needs @platform/bridge**: The branch with the whole desk links @platform/bridge from ../../../platform/packages/bridge, which is not in any repo this session can reach. Tickets, notices and answers can be tested once it is pushed.
- **Time Keepers sounds from your library**: Waiting for KeyLearn_World_Audio to be pushed (to assets-src/). The curated set in 458aeacf ships meanwhile.
- **Live checks**: Need the deployment: Brevo mail, pwnedpasswords reachability, HSTS through the live proxy, clamd, the ui_locale schema step. All are in docs/RELEASE-CHECKLIST.md.
- **Kuttichathan's hours**: He appears only in deep night (10 pm–4 am in the world clock). Keep, or widen to dusk?

## Results by area

| Area | What was tested | Checks | Result |
|---|---|---|---|
| Every route renders | en + ar, 1400 px + 390 px, light + dark, signed out + in | 248 | 208 of 248 loads clean; the rest explained below |
| Sign-up and sign-in | register, verify, password, magic link, reset | 20 | all 20 pass |
| Two-step verification | set up, sign in with code and recovery code, turn off | 10 | all 10 pass |
| Passkeys | add, sign in with passkey only, refused elsewhere | 5 | all 5 pass |
| Account deletion | emailed code, scheduled email, cancel link | 3 | all 3 pass |
| Adult practice, all modes | Guided, Classic, Frequent words, Books, Quotes, Numbers, Own text, Code craft | 34 | all 34 pass |
| Results and stats | results saved, profile and stats pages | 4 | all 4 pass |
| Typing test | timed test, report screen | 3 | all 3 pass |
| Kids worlds | Time Keepers, Dino Run, Hero Trail, Classic; ages 5–13 | 35 | 31 pass · 4 by design |
| Kids settings | world, character, companions persist | 13 | all 13 pass |
| Braille | six-key chords, accuracy, next line | 5 | all 5 pass |
| Multiplayer | two players, same passage, live speeds, chat | 6 | all 6 pass |
| Certificates | Course pane, gatekeeping, server refusals, verify page | 10 | all 10 pass |
| Grown-up PIN | set, gate, wrong PIN, right PIN | 5 | all 5 pass |
| Kid lock | kid menu, PIN before the grown-up profile | 7 | all 7 pass |
| Learner profiles | add, rename, delete, guardian consent | 5 | all 5 pass |
| Support tickets | log, reply, attachment rules, privacy between accounts | 11 | all 11 pass |
| Cross-site request guard | foreign Origin and Sec-Fetch-Site refused | 6 | all 6 pass |
| Accessibility audit (axe) | WCAG 2.1 A/AA on 26 routes × en/ar × signed out/in | 104 | 100 of 104 audits clean; the rest are the typing test's deliberate fade |
| Organisations | staff create a school, owner accepts, seats, learners, teacher invite, access log, outsiders refused | 16 | all 16 pass |
| Portable across devices | two browsers, one account: lessons, settings, kids, language, offline queue then sync | 9 | all 9 pass |
| Guest data stays on the device | never pushed to an account; export then import by hand instead | 12 | all 12 pass |
| QDesk sign-in (main) | passkey or password + code, desk session, sign-out, CAPTCHA after failures | 16 | **2 failing** (14 pass) |
| QDesk ↔ KeyLearn link security | ops key, account data, staff roster privacy, rate limit, audit log, proxy exposure | 13 | all 13 pass |
| QDesk performance | health under load, sign-in page, KeyLearn staff check, full staff sign-in | 4 | all 4 pass |
| QDesk stability | KeyLearn down and back, wrong ops key | 6 | **1 failing** (5 pass) |
| Certificate, actually earned | three weeks of history, three sittings, certificate issued and verified | 7 | all 7 pass |

## Found and fixed during this pass

| Commit | Area | What was wrong |
|---|---|---|
| `8898637a` | Kid lock | A child could tap the grown-up's profile in the menu and switch to it with no PIN, even when a grown-up PIN was set. It now asks for the PIN; a wrong PIN keeps the kid's profile. |
| `4f9d360a` | Multiplayer | Every racer's speed showed about five times too high: the rail printed characters per minute under a “wpm” label (a 200 wpm typist showed 904). Now words per minute, with a test. |
| `811edaa2` | Languages | Six new labels translated into all 54 languages (typing input, target-speed buttons, paragraph picker). |
| `aad04a8b` | Typography | Error page title used a hyphen as a dash; one French label had a space before a colon. Caught by the typography test. |
| `this pass` | Learner editor | First name, year born and last name were unnamed fields to a screen reader; now named by their captions (in 8898637a). |
| `72566ad1` | Accessibility | The typing area and every switch on the account page now have names; the critical axe findings are gone (0 critical on 104 audits). |
| `ac695037` | Typing test | The keystroke that ended a test could throw the report away. |
| `fb475783` | Practice | The new-key card can be left with the keyboard; stepper buttons are named. |
| `2cc6cc90` | Routing | /ar/assessment and /ar/join returned 404. |
| `8657563a` | Sign-up | The password breach check was blocked by the page's security policy. |
| `this pass` | Release checklist | Adds the virus scanner: without clamd every support attachment is refused (fails closed). |
| `1f569ed9` | Kuttichathan | Corridor lessons with no house, well or tree near the road (27 and others) never showed him. He now also squats in the road there. |
| `6e75d71d` | Passkeys | Cancelling “Add a passkey” showed the browser's raw error with a W3C link. Now a plain sentence, in every language. |
| `4fccf93a` | Portability | Every learner (kids too) syncs, offline edits are kept until the server has them and retried on reconnect, braille and key-pair stats travel. Guest data is never pushed to an account. |
| `b09aeddf` | Language | The chosen app language is saved on the account, so a second device opens in it. |
| `e14dc6f3` | Screen readers | Segmented choices say which is selected; option pickers announce as menus with their current value. |
| `37e50791` | Organisations | A school with every seat taken could not invite a teacher: teachers were counted as seats. |
| `1a81f4c7` | Certificates | The welcome tour opened over the first timed sitting on a new account, so no line was typed and nothing was recorded. And an empty sitting was headed “Sitting recorded”. |
| `64ae73fc` | Reminder emails | Turning reminders off in Preferences did not stop them: the mailer read the account's settings, not the learner's. |
| `6feab72b` | Importer | Now says it takes KeyLearn exports (the manual guest-to-account route) and offers kid profiles too. |
| `6da187a5` | Proxy | /_/internal (staff sign-in checks, email reveal, account deletion) was reachable from the internet, guarded only by the ops key. Refused at nginx now, except from the machine itself and listed addresses. |
| `4778fea9` | Staff check timing | An unknown email answered in about 3 ms and a real one in about 374 ms, so timing showed who had an account. Both now cost a password hash (404 vs 439 ms measured). |
| `d6adb1d1` | Rate limits | A burst across the four server workers got 40 of 60 staff checks through against a limit of 10. Now 12 (the limit plus workers less one), and paced attempts still get the whole limit. |
| `3661a2b (QDesk)` | QDesk sign-in | A KeyLearn that is down or refusing the key reached the sign-in page as a bare 500. Now a 503 with a sentence, like every other desk screen. On the desk branch. |
| `9b35d99f + b874a3a9` | Colour contrast | Muted text and the green accent were below WCAG AA on the default themes (serious findings on 78 of 104 pages). Two tokens deepened, the undefined --error-color defined, and five stragglers fixed. A fresh survey leaves only the typing test's deliberate fade. |
| `6fda71c7` | Screen readers | The page loader and the Course pane's progress bar had no name. |
| `ba8c2a79` | Course pane | After a certificate was issued the card still said Ready to sit and offered the sitting. Now Certificate earned, with a sit-again link only where a higher band is possible. |
| `28463b1b` | Guest kids' data | A guest's kids practice could not leave the device. The guest profile page now exports it, and it imports into a kid profile (tested end to end). |
| `b29515d9` | Braille | The counter said LINE while counting cells. |
| `20d9794a` | Kids | An unknown saved world made the trail request undefined.glb and throw while the child typed. Found while testing the guest export; it now loads the default world. |
| `8b57f5ed` | Kuttichathan | On the crossing (lessons 37–38) he never chose a look, so he was nearly always an unlit shape. He now picks the lamp, the halo or the dark per spot, and takes a lit look when the child sits. Lesson 38: 35 of 39 sitting and 15 of 20 walking on the current build (the earlier 0 of 40 came from a server on an older build). Lesson 8: 40 of 40 sitting, 20 of 20 walking. |
| `f71586ca` | Classic course | Every one-key drill (“d d d …”, a letter and a space) was completed and silently thrown away, because a result needed three different characters: the course could never count it. Found by the full feature pass; now saved and the course moves on. |
| `337cc738` | Time Keepers | Owner's call: letters on the trail for every age, on by default; the other worlds keep their age rules. |
| `18cbd361` | Kids settings | Owner's call: Classic moves to the Play page, for ages 9–13. |

## Kuttichathan, walking and sitting

Deep night in Time Keepers, for every lesson with a haunt. Walking samples are taken while the child moves along the road; sitting samples after the child stops typing and sits down. A sample counts when he is in the world.

| Lesson | Chapter | While walking | While sitting |
|---|---|---|---|
| 5 | 1 · The Village | 20 of 20 (road-stones) | 40 of 40 (wall-stones) |
| 6 | 1 · The Village | 20 of 20 (road-behind) | 31 of 31 (road-behind) |
| 7 | 1 · The Village | 20 of 20 (road-stones) | 40 of 40 (road-squat) |
| 8 | 1 · The Village | 20 of 20 (wall-stones) | 40 of 40 (wall-stones, road-behind) |
| 16 | 2 | 20 of 20 (road-squat) | 17 of 40 (road-squat) |
| 17 | 2 | 20 of 20 (house-stones) | 40 of 40 (road-squat) |
| 24 | 3 | 20 of 20 (road-squat) | 17 of 17 (road-squat) |
| 27 | 3 | 20 of 20 (road-squat) | 9 of 9 (road-squat) |
| 28 | 3 | 20 of 20 (road-behind) | 27 of 40 (road-behind) |
| 32 | 4 | 20 of 20 (road-stones) | 40 of 40 (road-stones) |
| 35 | 4 | 20 of 20 (road-squat) | 4 of 4 (road-squat) |
| 36 | 4 | 20 of 20 (road-stones) | 30 of 33 (rail) |
| 37 | Crossing | 20 of 20 (rail) | 36 of 40 (rail) |
| 38 | Crossing | 15 of 20 (island) | 35 of 39 (rail) |

## Behaving as designed

- **Typing test controls fade while you type**: “15s · Coach” drops to 28% opacity so nothing competes with the text, and comes back when the mouse moves. The only contrast finding left; WCAG treats it as an inactive control.
- **Time Keepers uploads at the milestone**: Results are held until the child reaches the lesson's milestone stone, so a single passage shows no upload. Other worlds upload per passage (they pass).
- **No email when a ticket is logged**: Replies come from QDesk; KeyLearn itself sends no acknowledgement.
- **Requests with no Origin header**: Allowed on purpose: the guard checks Sec-Fetch-Site then Origin, and a request with neither is not browser-driven. Session cookie is HttpOnly and SameSite=Lax.
- **Starting a certificate sitting while not eligible**: The server hands out the text, then refuses the sitting and the certificate (409). Nothing can be earned that way.
- **Kid at /account**: Sent back to /kids rather than shown a PIN prompt.

## Route crawl: loads that did not come back clean

- `/reset-password` ×8: Needs a reset token in the link; the bare path is a 404 by design (the reset flow itself passes).
- `/support` ×8: Loads a third-party script this sandbox cannot reach (ERR_TUNNEL). Not reproducible with internet access.
- `/support/deletion-cancel` ×8: Needs a cancel token; the emailed link works (Account deletion passes).
- `/for-schools` ×8: Switched off in the control centre by default (pages.forSchools.state = 404).
- `/support/t` ×8: Needs a ticket reference; bare path is a 404 by design (ticket threads pass in Support).

## Every check


### Sign-up and sign-in (20)

- ✅ form submits without errors
- ✅ a verification mail is sent
- ✅ the emailed code finishes sign-up and signs in
- ✅ the session ends
- ✅ no errors
- ✅ a wrong password is refused with a message
- ✅ the right password signs in
- ✅ no unexpected errors
- ✅ a sign-in email is sent
- ✅ following it signs you in
- ✅ no errors
- ✅ a reset email is sent
- ✅ page errors
- ✅ the old password is refused afterwards
- ✅ the new password works
- ✅ the link cannot be used twice
- ✅ a used link does not sign in a second browser
- ✅ a reused link did not change the password
- ✅ the date-of-birth field has an accessible name
- ✅ the breach check is no longer blocked by the CSP

### Two-step verification (10)

- ✅ turning it on with a valid code works
- ✅ recovery codes are shown once
- ✅ a password alone no longer signs in
- ✅ a wrong code is refused
- ✅ the right code signs in
- ✅ a recovery code signs in
- ✅ the same recovery code cannot be used twice
- ✅ no page errors
- ✅ it can be turned off again (Manage, then password)
- ✅ once off, a password alone signs in again

### Passkeys (5)

- ✅ adding one creates a credential
- ✅ add flow has no errors
- ✅ signing in with it works, no password
- ✅ sign-in has no errors
- ✅ a device without it is not signed in

### Account deletion (3)

- ✅ an emailed code confirms it
- ✅ no page errors
- ✅ Delete forever erases the account at once — DB row gone; its email now leads to sign-up

### Adult practice, all modes (34)

- ✅ shows text of the right kind
- ✅ the new-key card is a dialog, and Enter carries on
- ✅ typing the lesson through finishes it (new text appears)
- ✅ the result is saved to the account
- ✅ no errors
- ✅ shows text of the right kind
- ✅ the new-key card is a dialog, and Enter carries on
- ✅ typing the lesson through finishes it (new text appears)
- ✅ the result is saved to the account
- ✅ no errors
- ✅ shows text of the right kind
- ✅ typing the lesson through finishes it (new text appears)
- ✅ the result is saved to the account
- ✅ no errors
- ✅ shows text of the right kind
- ✅ typing the lesson through finishes it (new text appears)
- ✅ the result is saved to the account
- ✅ no errors
- ✅ shows text of the right kind
- ✅ typing the lesson through finishes it (new text appears)
- ✅ the result is saved to the account
- ✅ no errors
- ✅ shows text of the right kind
- ✅ typing the lesson through finishes it (new text appears)
- ✅ the result is saved to the account
- ✅ no errors
- ✅ shows text of the right kind
- ✅ typing the lesson through finishes it (new text appears)
- ✅ the result is saved to the account
- ✅ no errors
- ✅ shows text of the right kind
- ✅ typing the lesson through finishes it (new text appears)
- ✅ the result is saved to the account
- ✅ no errors

### Results and stats (4)

- ✅ progress page reflects the lessons just typed (a speed shown)
- ✅ each book offers 'Practise this'
- ✅ choosing a book starts practice on it
- ✅ no errors

### Typing test (3)

- ✅ the test shows words to type
- ✅ when the time is up a report appears with the speed
- ✅ no errors

### Kids worlds (35)

- ✅ a passage to type appears _(Leo · default)_
- ✅ typing the passage scores points _(Leo · default)_
- ✅ finishing it brings the next passage _(Leo · default)_
- ✅ the run is saved to the learner _(Leo · default)_
- ✅ no errors _(Leo · default)_
- ✅ a passage to type appears _(Mia · default)_
- ✅ a passage to type appears _(Ravi · default)_
- ✅ typing the passage scores points _(Mia · default)_
- ✅ finishing it brings the next passage _(Mia · default)_
- ✅ the run is saved to the learner _(Mia · default)_
- ✅ no errors _(Mia · default)_
- ⏸ typing the passage scores points _(Ravi · default)_
- ✅ finishing it brings the next passage _(Ravi · default)_
- ✅ the run is saved to the learner _(Ravi · default)_
- ✅ no errors _(Ravi · default)_
- ✅ a passage to type appears _(Mia · village)_
- ✅ a passage to type appears _(Ravi · village)_
- ✅ typing the passage scores points _(Mia · village)_
- ✅ finishing it brings the next passage _(Mia · village)_
- ⏸ the run is saved to the learner _(Mia · village)_
- ✅ no errors _(Mia · village)_
- ✅ typing the passage scores points _(Ravi · village)_
- ✅ finishing it brings the next passage _(Ravi · village)_
- ⏸ the run is saved to the learner _(Ravi · village)_
- ✅ no errors _(Ravi · village)_
- ✅ a passage to type appears _(Leo · hero)_
- ✅ a passage to type appears _(Leo · village)_
- ✅ typing the passage scores points _(Leo · hero)_
- ✅ finishing it brings the next passage _(Leo · hero)_
- ✅ the run is saved to the learner _(Leo · hero)_
- ✅ no errors _(Leo · hero)_
- ✅ typing the passage scores points _(Leo · village)_
- ✅ finishing it brings the next passage _(Leo · village)_
- ⏸ the run is saved to the learner _(Leo · village)_
- ✅ no errors _(Leo · village)_

### Kids settings (13)

- ✅ the world choice survives a reload
- ✅ no page errors
- ✅ Time Keepers shows letters on the trail by default, age 6
- ✅ Time Keepers shows letters on the trail by default, age 10
- ✅ Time Keepers shows letters on the trail by default, age 12 (no age bar)
- ✅ the switch is offered at 12 in Time Keepers, with no age tag
- ✅ switched off, Time Keepers shows the text panel
- ✅ Dino Run unchanged, age 12 keeps the text panel
- ✅ Dino Run unchanged, age 10 keeps the panel unless opted in
- ✅ Hero Trail unchanged, age 6 still always gets the blocks
- ✅ age 10 finds Classic on the Play page
- ✅ and no longer under Session
- ✅ age 6 is not offered Classic

### Braille (5)

- ✅ the line to type is shown as letters and cells
- ✅ speed and accuracy are measured
- ✅ no page errors
- ✅ a wrong cell counts against accuracy and the drill waits on the right one
- ✅ finishing the line brings a new one, from its first cell

### Multiplayer (6)

- ✅ two players are seated in the same room
- ✅ both players get the same passage
- ✅ the finisher's speed shows on the other player's screen
- ✅ a chat chip reaches the other player
- ✅ no page errors
- ✅ the race ends for the finisher, who is told they won

### Certificates (10)

- ✅ the Course pane lists what is still to prove
- ✅ /assessment turns an ineligible learner away with the next step
- ✅ issuing is refused for a learner who has not earned it
- ✅ a sitting that was never started is refused
- ✅ another account cannot start a sitting for this learner
- ✅ a malformed number is explained and Check stays off
- ✅ a well-formed number that was never issued says so
- ✅ the public API answers valid:false
- ✅ a number in the link is checked on arrival
- ✅ no page errors

### Grown-up PIN (5)

- ✅ a grown-up PIN can be set
- ✅ the account page is locked behind it at once
- ✅ a wrong PIN is refused, with a message
- ✅ the right PIN opens the account
- ✅ no page errors

### Kid lock (7)

- ✅ grown-up links are disabled in a kid's menu
- ✅ switching a kid to the grown-up asks for the PIN
- ✅ a wrong PIN keeps the kid's profile
- ✅ support tickets are closed to the kid's session
- ✅ the right PIN switches to the grown-up
- ✅ no page errors
- ✅ a kid going straight to /account is kept out (PIN or sent back to /kids)

### Learner profiles (5)

- ✅ consenting for a child asks the grown-up to confirm
- ✅ a braille learner can be added
- ✅ renaming a learner sticks after a reload
- ✅ a learner can be deleted
- ✅ no page errors

### Support tickets (11)

- ✅ a ticket can be logged and shows in the list
- ✅ a .txt attachment is refused with a clear message
- ✅ a reply can be added to the ticket
- ✅ the ticket is listed by the API for this account
- ✅ back in the list, the ticket is there
- ✅ no page errors
- ✅ another account cannot read someone else's ticket
- ✅ another account cannot reply to it
- ✅ another account cannot close it
- ✅ signed out, tickets are not readable
- ✅ control — the owner, same-origin, can reply

### Cross-site request guard (6)

- ✅ a post from another site's Origin is refused
- ✅ (PIN endpoint) a foreign Origin is refused
- ✅ Sec-Fetch-Site: cross-site is refused
- ✅ Sec-Fetch-Site: same-site is refused
- ✅ control — Sec-Fetch-Site: same-origin is accepted
- ✅ the session cookie is HttpOnly and SameSite=Lax


### Organisations (16)

- ✅ a non-staff account cannot create one
- ✅ a non-staff account cannot create an organisation
- ✅ platform staff create an organisation and get the owner's invite link
- ✅ the invited owner accepts and the school is theirs
- ✅ an outsider cannot read the school or its learners
- ✅ owner desk has no page errors
- ✅ the owner adds a class
- ✅ learners are added to the class (up to the seats)
- ✅ a wrong PIN does not sign the learner in
- ✅ the right PIN signs the learner in
- ✅ a fourth learner is refused (seats)
- ✅ a used invite is refused for anyone
- ✅ looking at a learner is written to the access log (who and what)
- ✅ a teacher invite is emailed
- ✅ the teacher accepts and joins as a teacher
- ✅ a teacher is not platform staff

### Portable across devices (9)

- ✅ a page opened with no language in the address comes up in the language chosen elsewhere
- ✅ …and any address without one is sent there too
- ✅ choosing English again sticks (no redirect back)
- ✅ the speed unit set on the other device
- ✅ an accessibility setting made on the other device
- ✅ a kid's game world chosen on the other device
- ✅ a braille learner's voice speed from the other device
- ✅ a change made offline reaches another device once back online
- ✅ no page errors on any device

### Guest data stays on the device (12)

- ✅ a lesson typed as a guest is kept on the device
- ✅ the guest can export their progress as a file
- ✅ a guest's kids setting did not land on the account
- ✅ the guest's lessons were not sent to the account on their own
- ✅ importing the exported file adds the guest's lessons to the chosen learner
- ✅ no page errors
- ✅ a passage typed on the kids pages is kept on the device
- ✅ the guest profile page offers the kids' practice as a file
- ✅ the file holds the kids' results in the export format
- ✅ no page errors
- ✅ the importer offers the account's kid profiles
- ✅ the file imports into the kid's profile

### QDesk sign-in (main) (16)

- ✅ signed out, the desk sends you to sign-in
- ✅ the sign-in page offers a passkey or password and code
- ✅ choosing password shows email and password
- ✅ a correct staff password asks for the two-step code
- ❌ the staff password is not kept in plain text in the session store between steps
- ✅ the right code signs in and the desk names the staff member
- ✅ the desk session cookie is HttpOnly and SameSite=Lax
- ✅ the desk's cookie is its own, never KeyLearn's
- ✅ sign out returns to the sign-in page
- ✅ the old cookie is dead after sign-out
- ✅ no page errors
- ✅ a wrong password is refused
- ✅ an ordinary KeyLearn account cannot sign in to the desk
- ✅ a code with no password step first is refused
- ✅ after repeated failures, a CAPTCHA is required even with the right password
- ❌ a cross-site POST is refused

### QDesk ↔ KeyLearn link security (13)

- ✅ no key is refused
- ✅ a wrong key is refused
- ✅ a key one character off is refused
- ✅ account data needs the key too
- ✅ revealing an email with a wrong key is refused
- ✅ with the key, a staff password is recognised and two-step is asked for
- ✅ a non-staff account is refused
- ✅ an unknown email and a wrong password get the same answer (no account probing)
- ✅ a wrong two-step code is refused
- ✅ KeyLearn rate-limits repeated staff sign-in attempts
- ✅ refused key attempts are written to the staff audit log
- ✅ the shipped proxy config keeps /_/internal off the public internet
- ✅ an unknown email takes about as long as a wrong password (no timing oracle)

### QDesk performance (4)

- ✅ QDesk health answers fast under 20 at once (p95 < 100 ms)
- ✅ the sign-in page is served quickly (p95 < 150 ms)
- ✅ KeyLearn's staff check answers within 500 ms (p95)
- ✅ a full staff sign-in through QDesk (password + code) takes under 1.5 s

### QDesk stability (6)

- ✅ with KeyLearn down, sign-in fails with an error, not a hang
- ❌ with KeyLearn down, the message is readable (not an internal error dump)
- ✅ QDesk itself stays up while KeyLearn is down
- ✅ when KeyLearn is back, sign-in works again with no QDesk restart
- ✅ a desk with the wrong key refuses sign-in rather than letting anyone in
- ✅ a wrong key reads as a setup problem, not as a wrong password

### Certificate, actually earned (7)

- ✅ three weeks of history imported for the test learner
- ✅ the Course pane offers the assessment once everything is proved
- ✅ the public verify API confirms the new certificate
- ✅ the verify page, signed out, shows it as issued by KeyLearn
- ✅ a made-up number does not verify
- ✅ no page errors
- ✅ the Course pane offers the earned certificate

---
Checks rewritten because the first version of the test was wrong are not counted (16 of them). Colour-contrast findings count in the accessibility row only.
