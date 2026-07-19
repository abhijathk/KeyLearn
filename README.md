# KeyLearn — smart touch-typing tutor for adults and kids

KeyLearn is an adaptive typing tutor that teaches touch typing the smart way:

* It tracks every single keystroke and computes statistics for each individual key.
* It automatically generates lessons that focus on your weakest keys.
* You can set your own target typing speed, and it tracks your progress toward that goal.
* It starts with a small set of the most frequent letters in your language.
* More letters are added once you reach the target speed with the current ones.
* It can even predict how many more lessons you will need to complete to reach your target speed.
* It provides a beautiful profile page with detailed graphs showing your learning progress.
* It offers plenty of modes and configuration options.
* No advertising, ever.

KeyLearn is being developed with two audiences in mind: a minimalist, distraction-free
experience for adults, and a friendly, encouraging mode designed for kids who are
learning to type (and often to read) at the same time.

## Getting started

See [docs/getting_started.md](./docs/getting_started.md) to launch a local instance.

## Roadmap

* Kids mode: kid-friendly vocabulary, typography, sounds, and celebrations.
* A modern minimalist UI based on Material 3 design, for both adults and kids.
* Smarter practice engine: bigram-level statistics, accuracy-aware progression,
  and skill decay modeling.
* Refreshed multi-language word corpora built from openly licensed sources.

## Acknowledgements

KeyLearn is a fork of [keybr.com](https://github.com/aradzie/keybr.com) by
Aliaksandr Radzivanovich, an outstanding open-source typing tutor. The adaptive
lesson engine, phonetic word models, and much of the foundation of this project
originate there. Full commit history is preserved in this repository.

## License

Released under the GNU Affero General Public License v3.0, the same license as
the upstream project. If you run a modified version of KeyLearn as a network
service, you must make your modified source code available to its users under
the same license.
