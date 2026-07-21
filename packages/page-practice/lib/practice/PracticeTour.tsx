import { KeyLegendList, names } from "@keybr/lesson-ui";
import { Slide, Tour } from "@keybr/widget";
import { memo } from "react";
import { FormattedMessage } from "react-intl";
import { KeyDetailsChartDemo } from "./KeyDetailsChartDemo.tsx";

export const PracticeTour = memo(function PracticeTour({
  onClose,
}: {
  readonly onClose?: () => void;
}) {
  return (
    <Tour onClose={onClose}>
      <Slide size="large">
        <FormattedMessage
          id="m_tour01"
          defaultMessage={
            "<h1>Type Faster With Confidence</h1>" +
            "<p>KeyLearn teaches you <em>touch typing</em> — typing from muscle memory instead of hunting for keys with your eyes. It can boost both your speed and accuracy by a wide margin. The alternative is <em>hunt-and-peck typing</em>, where you keep glancing down at the keyboard and rely mostly on your index fingers.</p>" +
            "<p>This short walkthrough covers how the app works.</p>" +
            "<p>Use the left and right arrow keys to move between these slides.</p>"
          }
        />
      </Slide>
      <Slide size="large">
        <FormattedMessage
          id="m_tour02"
          defaultMessage={
            "<p>Here’s what our teaching approach is built on:</p>" +
            "<p>No tedious drilling. Unlike many typing tutors, KeyLearn never makes you repeat the same block like ‘<em>jjf jjk jjf jjk</em>’ over and over. That gets tiresome fast and barely helps you learn.</p>" +
            "<p>Instead, an algorithm builds lessons that match your current skill level. Each lesson is made of random words drawn from a subset of your alphabet’s letters. The algorithm decides how large that subset is and how often each letter shows up, aiming to give you the most effective learning experience.</p>"
          }
        />
      </Slide>
      <Slide size="large">
        <FormattedMessage
          id="m_tour03"
          defaultMessage={
            "<p>At the start, words are generated from just a handful of the alphabet’s most common letters.</p>" +
            "<p>As you type those words, the app tracks a time-to-type measurement for each letter in the subset. That measurement is how your progress gets tracked — the more comfortable you get with a letter, the faster you type it.</p>" +
            "<p>Once you’re comfortable with the whole current subset, the algorithm grows it by folding in additional letters.</p>"
          }
        />
      </Slide>
      <Slide size="large">
        <FormattedMessage
          id="m_tour04"
          defaultMessage={
            "<p>Whenever a new letter joins the subset, its frequency gets boosted so it shows up in nearly every generated word of a lesson.</p>" +
            "<p>The algorithm also reshuffles letter frequencies on purpose, giving more weight to whichever letters have the slowest time-to-type readings.</p>" +
            "<p>In practice, that keeps you typing the letters you’re least comfortable with.</p>"
          }
        />
      </Slide>
      <Slide size="small" anchor={`#${names.textInput}`} position="block-end">
        <FormattedMessage
          id="m_tour05"
          defaultMessage="<p>This is the text board, showing the passage you need to type. It refreshes with every new lesson and is built automatically from your current letter subset. Most of these words aren’t real — they’re generated from your language’s phonetic rules so they still sound natural and are easy to pronounce. It’s a bit playful, and it also lets us draw from a far larger pool of words than actually exist.</p>"
        />
      </Slide>
      <Slide size="small" anchor={`#${names.keyboard}`} position="block-start">
        <FormattedMessage
          id="m_tour06"
          defaultMessage="<p>This is the virtual keyboard, which helps you memorize where each key sits. Use it to locate keys instead of glancing down at your physical keyboard. Your keyboard’s <em>F</em> and <em>J</em> keys have small raised bumps — feel for these to line up your index fingers without looking. Once your index fingers are correctly placed, you’ll be able to find every other key from there.</p>"
        />
      </Slide>
      <Slide size="small" anchor={`#${names.speed}`} position="block-end">
        <FormattedMessage
          id="m_tour07"
          defaultMessage={
            "<p>This shows your typing speed and how it compares to your average. Higher numbers here are the goal.</p>" +
            "<p>Speed is measured in either <em>Words per Minute (WPM)</em> or <em>Characters per Minute (CPM)</em>. Since a word is standardized to five characters, <em>10WPM</em> works out to <em>50CPM</em>.</p>" +
            "<p>You can toggle between <em>WPM</em> and <em>CPM</em> on the Settings page.</p>"
          }
        />
      </Slide>
      <Slide size="small" anchor={`#${names.accuracy}`} position="block-end">
        <FormattedMessage
          id="m_tour08"
          defaultMessage={
            "<p>This is your accuracy reading, along with how it compares to your average. As with speed, higher is better here.</p>" +
            "<p>Accuracy is the percentage of characters you typed correctly. Repeated mistakes at the same spot only count as a single error.</p>"
          }
        />
      </Slide>
      <Slide size="small" anchor={`#${names.score}`} position="block-end">
        <FormattedMessage
          id="m_tour09"
          defaultMessage={
            "<p>This is your score, shown in abstract points, along with how it differs from your average.</p>" +
            "<p>It’s calculated from your speed, your error count, and how many letters are currently in your set. The formula rewards fast typing and penalizes mistakes, so typing quickly while making lots of errors won’t earn you a high score.</p>"
          }
        />
      </Slide>
      <Slide size="small" anchor={`#${names.keySet}`} position="block-end">
        <FormattedMessage
          id="m_tour10"
          defaultMessage="<p>This trail maps the letters currently used to build your lessons, in the order you unlock them, each one coloured by how confident you are with it:</p>"
        />
        <KeyLegendList />
      </Slide>
      <Slide size="small" anchor={`#${names.keySet}`} position="block-end">
        <FormattedMessage
          id="m_tour11"
          defaultMessage="<p>Hovering a stop on the trail forecasts how many lessons remain before that letter fully unlocks, as shown in the sample chart below. Check back often for a clearer picture of how your learning is progressing.</p>"
        />
        <KeyDetailsChartDemo />
      </Slide>
      <Slide size="small" anchor={`#${names.currentKey}`} position="block-end">
        <FormattedMessage
          id="m_tour12"
          defaultMessage={
            "<p>This shows details for the letter that’s currently boosted in frequency and appearing in every generated word:</p>" +
            "<dl>" +
            "<dt>Top typing speed</dt>" +
            "<dd>The fastest you’ve ever typed this particular letter.</dd>" +
            "<dt>Confidence score</dt>" +
            "<dd>A value between zero and one, calculated from your typing speed, showing how well you know this letter. Once confidence reaches one, the letter counts as fully learned.</dd>" +
            "<dt>Learning rate</dt>" +
            "<dd>How your speed on this letter is trending from lesson to lesson.</dd>" +
            "</dl>"
          }
        />
      </Slide>
    </Tour>
  );
});
