Keylearn Issues and Changes
1. found vegitations in the water in lesson 37 and 38.. need to fix it..
   - FIXED (6 Oct 2026). The roadside plant clusters and plots only avoided Hero Trail's lakes, not the village's wide river, so foliage grew on the riverbed. They now skip any spot below the river's surface. Checked on lessons 37 and 38: no plants left in the water (only the riverbed pebbles, which belong there).
2. i want the hero trial and dino run game page same like the timekeeper single window/chip panel.. all in one window rther than two windows and text inbetwwn.. need tot use the itmekeeprt kind of panel design and transition between 3d panel and othe rpart.. also the dynamic resizing as per the window size.. both games should have same game windo size and shape of the timekeeper window.
   - DONE. Hero Trail and Dino Run now use Time Keepers' single window: scene, coach's line and keyboard in one frame, the same fade from the 3D scene into the panel, and the same size, shape and resizing with the browser window.
3. if the user want ot practice anthign other than guided practice need a login .. i mean signed up to the website.. if user is not logged in only guided practice should be available.. othewie it is hard to manage dat in local drive if many people accessing the webite in the same machine.. also the relevent pracice settings.. a lock icon and toast meaasge on the section the user clicks like in the keyboard selection..
   - DONE. Guests get Guided practice only. Classic course, Code craft, Frequent words, Book Text, Quotes, Your Own Text and Number Drills stay visible with a padlock, in Settings and on the Texts page. Clicking one says "Sign in to choose what you practise." Their settings panels only open for a signed-in user. A guest's earlier choice is not deleted; it comes back when they sign in.
   - Not locked, by decision (6 Oct 2026): the Typing test, Multiplayer and Braille pages stay open to guests.
4. Make sure all three game level lesson and scores are updating in db and satart from her it left off next time in any machine..
   - DONE. All three games already saved lessons, scores, unlocked letters and growth per profile to the DB. The real gap was that an older copy on one device could overwrite newer progress from another device. Fixed: tabs refresh after a profile switch and when you come back to them, and a save during a profile switch can no longer land on the wrong child. Tests prove a second device gets each game's progress back and a sibling profile does not.
   - Still open: the same child playing on two devices at the same moment is last-save-wins.
5. In dino run no ring showing above the head of main char.. and in hero trial the ring or pumpkin are too close to the head.. need to be bit more above like before..
   - FIXED. Dino Run now has the ring above the player. In Hero Trail the ring and pumpkin sit higher again: the characters were made 15% taller and the ring had not been moved up with them.

Qdesk Issues and changes
1. signup calander widget hover bubble is partially visible when hover on top row and why ther is a horizontal scroller for this widget?
   - FIXED. The bubble was clipped by the calendar's scrolling strip; it now floats above everything, drops below the cell when there is no room above, and stays inside the screen. The scrollbar came from the last month label ("Oct") running past the grid, and on tablet widths from a year that did not fit. No sideways scroll on desktop or tablet now; phones still scroll the year, as decided earlier.

***udate this document after implementing or fixing these ssues***
