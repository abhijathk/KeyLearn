# Chapter 3 browser captures

Actual local game renders at 1440 × 900, using the fixed village camera. Day captures use 14:00; night captures use the full night presentation at 02:00. Each pair comes from the same loaded scene. These are visual review artifacts, not generated concept images.

| Lesson | Scene | Day | Night |
| --- | --- | --- | --- |
| 21 | Village Road | [Day](lesson-21-5-6-day.png) | [Night](lesson-21-5-6-night.png) |
| 22 | Outer Houses | [Day](lesson-22-5-6-day.png) | [Night](lesson-22-5-6-night.png) |
| 23 | Village Lane | [Day](lesson-23-9-10-day.png) | [Night](lesson-23-9-10-night.png) |
| 24 | Banyan Junction | [Day](lesson-24-9-10-day.png) | [Night](lesson-24-9-10-night.png) |
| 25 | Great Market | [Day](lesson-25-5-6-day.png) | [Night](lesson-25-5-6-night.png) |
| 26 | Temple Street | [Day](lesson-26-5-6-day.png) | [Night](lesson-26-5-6-night.png) |
| 27 | Playground | [Day](lesson-27-9-10-day.png) | [Night](lesson-27-9-10-night.png) |
| 28 | Quiet Houses | [Day](lesson-28-9-10-day.png) | [Night](lesson-28-9-10-night.png) |
| 29 | Edge Gardens | [Day](lesson-29-5-6-day.png) | [Night](lesson-29-5-6-night.png) |
| 30 | Quiet Road | [Day](lesson-30-5-6-day.png) | [Night](lesson-30-5-6-night.png) |

[Browser results](browser-report.json) record page exceptions and failed asset requests per lesson. Captures cover two age bands; placement and market-depth tests cover all four. Static screenshots do not verify every transient animation or every position along the road.

[Implementation details](../chapter3-implementation.md) describe scene mapping, timing, depth scaling and validation.

[Reference audit](../chapter3-reference-audit.md) maps all ten lessons to the source document and records the requested market-free Lesson 27 opening. [Placement measurements](placement-audit.json) cover all four age bands, including carts, wells, buildings, gates and animated-prop movement space. The seated blacksmith is restricted to his forge in the roadside market row.
