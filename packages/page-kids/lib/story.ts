/**
 * The Time Keepers story, in the order it is told.
 *
 * Its own module because it is CONTENT: three hundred lines of prose has no
 * business sitting in the middle of a component, and keeping it apart means it
 * can be proof-read, translated or replaced without anybody reading the render
 * logic. Generated from the story document rather than retyped, so what ships
 * is what was approved.
 *
 * Tokens are the same ones the coach lines use — {name}, {guide}, {mate},
 * {years} — and are filled at read time, so a child who renamed Dave reads
 * their own name in the story and the {years} is counted rather than written
 * down.
 */
export type StoryPart = {
  readonly title: string;
  /**
   * The milestone that opens it. Zero means it is open from the very start.
   *
   * Milestones and not keys, deliberately: the story is about how far along
   * the road they have walked, and that is what a milestone counts.
   */
  readonly stone: number;
  /** Opens only when every letter is known — the ending, and there is one. */
  readonly graduate?: boolean;
  readonly text: readonly string[];
};

export const STORY: readonly StoryPart[] = [
  {
    title: "The old machine",
    stone: 0,
    text: [
      "It was raining, and there was nothing to do.",
      "Dave found the machine at the back of a cupboard. It was heavy and grey and older than anybody's grandmother. It had letters on it, in rows, like a keyboard — but the keys were round, and stiff, and there was red dust in all the gaps.",
      "Little Drew pressed one. Just one.",
      "The rain stopped. Not slowly — all at once, the way a sound stops when you shut a door. And when they looked up, the cupboard was gone, and the room was gone, and it was very, very warm.",
    ],
  },
  {
    title: "A road that wasn't there yesterday",
    stone: 2,
    text: [
      "The road was red. Not brown — red, like a plant pot, and warm under their shoes.",
      "There were no cars. That was the first thing Peeli noticed. Then she noticed the rest of it: no wires overhead, no aerials, no white lines on the road, no sound of traffic anywhere at all. Just birds, and something creaking a long way off.",
      "There was a stone by the side of the road with a number cut into it. Somebody had cut that number by hand.",
      "Peeli worked out the year before either of the boys did. She did not say it out loud for a while. When she did, she said it twice, because the first time nobody believed her.",
      "They were {years} years from home.",
    ],
  },
  {
    title: "The boy who wasn't surprised",
    stone: 5,
    text: [
      "Everybody stared at them. Everybody except one boy.",
      "He came down the road, looked at their shoes, looked at their faces, and said hello as though three strange children turned up on his road every week. His name is {guide}. He is about their age. He knows this road the way you know your own street.",
      "He showed them the lamps on their posts, and the fields, and which way the village was. He has been showing them things ever since.",
      "They gave him a jacket, because he was interested in it. He has worn it every day since — which is how you can tell, in a whole village of people, which one is theirs.",
    ],
  },
  {
    title: "The first night",
    stone: 8,
    text: [
      "There are street lamps here. That was the surprise.",
      "Not the kind that come on by themselves. Somebody walks the road at dusk with a taper and lights them, one at a time, all the way along — little flames in little stone houses, each one on its own post. {guide} says the word for them, and it is a long one, and they have all learned it: vazhivilakku. At the market there is a brighter one that hisses, white instead of orange, and that one is a petromax.",
      "So the road is lit. It is everything else that goes.",
      "Between one lamp and the next the fields simply stop existing. No glow on the horizon, no windows, nothing — the dark out there is a solid thing, and you walk from one warm orange pool into the next like stepping between islands. None of them had ever seen dark like it, because in the city there is no such thing.",
      "The best of it was the temple. You see it through the branches of the big tree and it is full of small flames, rows and rows of them along every step, and the whole of it moves very slightly all the time. Nobody said anything for a while.",
      "And then Dave looked up. With no electric light for a hundred miles there were stars — thousands of them, more than any of them knew there were. Peeli said it was the smoke making her eyes water. It was not the smoke.",
    ],
  },
  {
    title: "The animal in the field",
    stone: 11,
    text: [
      "It is bigger than a car. That is the thing nobody tells you about a buffalo. In a book it is a picture. In a field it is the size of a car, and it is looking at you.",
      "The first time, it put its head down and ran. All three of them ran too. {guide} did not move at all.",
      "It stopped, about ten steps away, and snorted, and went back to eating. It always stops. It has never once not stopped. {guide} laughed so much he had to sit down.",
    ],
  },
  {
    title: "The two who came with us",
    stone: 15,
    text: [
      "Two things came through with them.",
      "The puppy is no trouble. The village is full of dogs and one more is one more. It sniffs everything, it gets under everybody's feet, and within a week three people were feeding it.",
      "The robot is trouble. Not bad trouble — it is just that nothing in this whole century looks anything like it. Small children follow it down the road in a line. An old woman outside the market put her hand flat on its head once and said something nobody translated, and then she laughed, and then she gave them all a banana.",
    ],
  },
  {
    title: "Not strangers any more",
    stone: 19,
    text: [
      "For a long time everybody looked at them. The clothes. The shoes. The way they talked, which was too fast and full of words nobody had ever needed.",
      "Then, slowly, people stopped looking.",
      "The woman at the market started putting three things aside instead of two. Somebody on a cart lifted a hand as they went past. And one evening a man outside the temple said {name} — said it properly, said it like a name and not like a strange noise — and after that it was quite hard to remember being stared at.",
    ],
  },
  {
    title: "The way home",
    stone: 0,
    graduate: true,
    text: [
      "Here is the thing about the machine.",
      "It brought them here with one key. It will only take them back with all of them. Every letter, every single one, known properly — not hunted for, not guessed at. Known.",
      "That is what the road is. Every letter they learn is a bit more of it walked, and every stone they pass has a number on it saying how much. When they know all twenty-six, the road runs out, and the way home is at the end of it.",
      "They are quite close now.",
      "Nobody has said anything yet about whether they want to go.",
    ],
  },
];
