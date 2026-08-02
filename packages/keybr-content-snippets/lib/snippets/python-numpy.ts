import { type Snippet } from "../types.ts";

/**
 * NumPy, statistics and the plots an analyst actually produces.
 *
 * The arithmetic half of the job. Kept to what appears in real analysis rather
 * than to a tour of the API: broadcasting because it is the idea everything
 * else rests on, and the statistical tests because reaching for the wrong one
 * is the most expensive mistake on this page.
 */
export const pythonNumpy: readonly Snippet[] = [
  {
    id: "py-np-array",
    title: "An array, and why it is not a list",
    level: 1,
    tags: ["numpy", "basics"],
    code: `# One dtype for the whole array, laid out contiguously. That is what makes
# the arithmetic below run in C instead of in a Python loop.
values = np.array([12.5, 8.0, 19.25, 4.75], dtype=np.float64)`,
  },
  {
    id: "py-np-zeros",
    title: "Allocate before filling",
    level: 2,
    tags: ["numpy", "basics"],
    code: `# Growing an array in a loop copies it every time. Allocating the final
# shape once and writing into it does not.
result = np.zeros((1000, 3), dtype=np.float32)`,
  },
  {
    id: "py-np-arange-linspace",
    title: "Ranges by step, and ranges by count",
    level: 2,
    tags: ["numpy", "basics"],
    code: `# arange takes a step and excludes the end; linspace takes a count and
# includes it. For a plot axis linspace is nearly always the one meant.
steps = np.arange(0, 10, 0.5)
grid = np.linspace(0, 1, num=101)`,
  },
  {
    id: "py-np-vectorise",
    title: "Arithmetic on whole arrays",
    level: 2,
    tags: ["numpy", "basics"],
    code: `# No loop, no map, no comprehension. The same expression written over
# scalars in a Python loop is typically fifty times slower.
celsius = (fahrenheit - 32) * 5 / 9`,
  },
  {
    id: "py-np-broadcasting",
    title: "Broadcasting: operating across shapes",
    level: 4,
    tags: ["numpy", "basics"],
    code: `# Subtracting a (3,) row from a (1000, 3) matrix applies it to every row.
# The rule is that dimensions match if they are equal or one of them is 1.
centred = observations - observations.mean(axis=0)`,
  },
  {
    id: "py-np-axis",
    title: "The axis argument, and which way it goes",
    level: 3,
    tags: ["numpy", "basics"],
    code: `# axis is the dimension that gets collapsed, not the one you keep. axis=0
# removes the rows and leaves one value per column.
per_column = matrix.sum(axis=0)
per_row = matrix.sum(axis=1)`,
  },
  {
    id: "py-np-reshape",
    title: "Reshape without copying",
    level: 3,
    tags: ["numpy", "basics"],
    code: `# -1 means "work this one out from the others". reshape returns a view
# where it can, so this is usually free.
flat = matrix.reshape(-1)
columns = flat.reshape(-1, 3)`,
  },
  {
    id: "py-np-boolean-index",
    title: "Select with a boolean array",
    level: 3,
    tags: ["numpy", "select"],
    code: `# The mask is an array of booleans the same shape as the data, so it can
# be built up, named and reused rather than buried inside the brackets.
outliers = np.abs(values - values.mean()) > 3 * values.std()
clean = values[~outliers]`,
  },
  {
    id: "py-np-where",
    title: "Find the positions, not the values",
    level: 3,
    tags: ["numpy", "select"],
    code: `# With one argument, where() returns indices. Useful when you need to
# reach into another array at the same positions.
(indices,) = np.where(values > 10)`,
  },
  {
    id: "py-np-nan-aware",
    title: "Statistics that survive a missing value",
    level: 3,
    tags: ["numpy", "stats"],
    code: `# A single NaN makes mean() return NaN for the entire array. The nan-
# prefixed versions skip them, which is nearly always what was wanted.
average = np.nanmean(values)
spread = np.nanstd(values, ddof=1)`,
  },
  {
    id: "py-np-ddof",
    title: "Sample standard deviation, not population",
    level: 4,
    tags: ["numpy", "stats"],
    code: `# NumPy defaults to ddof=0, which is the population formula. Data is
# almost always a sample, and pandas defaults the other way — so they
# disagree unless you say which you mean.
sample_std = values.std(ddof=1)`,
  },
  {
    id: "py-np-percentile",
    title: "Percentiles and the median",
    level: 2,
    tags: ["numpy", "stats"],
    code: `# Reporting the median beside the mean is how a long tail announces
# itself: when they diverge, the average is not describing a typical case.
p50, p90, p99 = np.percentile(values, [50, 90, 99])`,
  },
  {
    id: "py-np-correlation",
    title: "Correlation between two variables",
    level: 3,
    tags: ["numpy", "stats"],
    code: `# Pearson's r measures a straight-line relationship only. A perfect
# parabola scores near zero, so plot the data before trusting the number.
r = np.corrcoef(spend, revenue)[0, 1]`,
  },
  {
    id: "py-np-polyfit",
    title: "Fit a straight line",
    level: 4,
    tags: ["numpy", "stats"],
    code: `# Least squares, degree 1. The slope is the change in y per unit of x,
# which is usually the sentence the analysis is trying to produce.
slope, intercept = np.polyfit(spend, revenue, deg=1)`,
  },
  {
    id: "py-np-random-seed",
    title: "Random numbers you can reproduce",
    level: 3,
    tags: ["numpy", "stats"],
    code: `# The modern generator API, and a fixed seed. np.random.seed() sets
# global state that anything else can change underneath you.
rng = np.random.default_rng(seed=42)
sample = rng.normal(loc=100, scale=15, size=1000)`,
  },
  {
    id: "py-np-bootstrap",
    title: "A bootstrap confidence interval",
    level: 5,
    tags: ["numpy", "stats"],
    code: `# Resample with replacement, recompute, and read the percentiles off the
# result. It makes no assumption about the shape of the distribution.
rng = np.random.default_rng(seed=42)
means = np.array(
    [rng.choice(values, size=values.size, replace=True).mean() for _ in range(10_000)]
)
lower, upper = np.percentile(means, [2.5, 97.5])`,
  },
  {
    id: "py-stats-ttest",
    title: "Compare two group means",
    level: 4,
    tags: ["stats", "testing"],
    code: `# Welch's test, which does not assume the two groups have equal variance.
# The equal-variance default is rarely justified and rarely checked.
from scipy import stats

result = stats.ttest_ind(control, variant, equal_var=False)`,
  },
  {
    id: "py-stats-mannwhitney",
    title: "Compare two groups without assuming normality",
    level: 5,
    tags: ["stats", "testing"],
    code: `# For skewed data — revenue, session length, anything with a long tail —
# this compares ranks rather than means and is not thrown by the outliers.
result = stats.mannwhitneyu(control, variant, alternative="two-sided")`,
  },
  {
    id: "py-stats-chi2",
    title: "Test whether two categories are related",
    level: 4,
    tags: ["stats", "testing"],
    code: `# The test for a contingency table: did conversion differ by variant, or
# is the difference the sort of thing chance produces at this sample size?
table = pd.crosstab(experiments["variant"], experiments["converted"])
chi2, p_value, dof, expected = stats.chi2_contingency(table)`,
  },
  {
    id: "py-stats-effect-size",
    title: "Report an effect size, not only a p-value",
    level: 5,
    tags: ["stats", "testing"],
    code: `# With enough rows, everything is significant. Cohen's d says how large
# the difference is, which is the part anyone can act on.
pooled = np.sqrt((control.var(ddof=1) + variant.var(ddof=1)) / 2)
cohens_d = (variant.mean() - control.mean()) / pooled`,
  },
  {
    id: "py-stats-sample-size",
    title: "Work out the sample size before running the test",
    level: 5,
    tags: ["stats", "testing"],
    code: `# Deciding afterwards how long to run is how a null result becomes a
# positive one. This is the number of observations per arm.
from statsmodels.stats.power import TTestIndPower

n_per_arm = TTestIndPower().solve_power(
    effect_size=0.2,
    alpha=0.05,
    power=0.8,
)`,
  },
  {
    id: "py-plot-figure",
    title: "A figure and axes, explicitly",
    level: 2,
    tags: ["viz"],
    code: `# The object API rather than the pyplot state machine: with two charts on
# a page, plt.plot() stops being clear about which one it is drawing on.
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(8, 4.5))`,
  },
  {
    id: "py-plot-line",
    title: "A line chart with its axes labelled",
    level: 2,
    tags: ["viz"],
    code: `# The labels are not decoration. A chart that leaves the reader guessing
# at the units has not finished making its point.
ax.plot(daily.index, daily.values, linewidth=1.5)
ax.set_xlabel("Date")
ax.set_ylabel("Revenue (AUD)")
ax.set_title("Daily revenue")`,
  },
  {
    id: "py-plot-bar-sorted",
    title: "A bar chart, sorted",
    level: 3,
    tags: ["viz"],
    code: `# Sorted by value unless the categories have a natural order of their
# own. Alphabetical bars make the reader do the comparison themselves.
ranked = by_country.sort_values("revenue", ascending=True)
ax.barh(ranked["country"], ranked["revenue"])`,
  },
  {
    id: "py-plot-hist",
    title: "A distribution",
    level: 3,
    tags: ["viz"],
    code: `# The bin count changes the story a histogram tells, so it is worth
# choosing rather than accepting. Ten is rarely the right number.
ax.hist(values, bins=50, edgecolor="white")
ax.set_xlabel("Order total (AUD)")`,
  },
  {
    id: "py-plot-scatter",
    title: "A scatter plot with overlapping points",
    level: 3,
    tags: ["viz"],
    code: `# alpha turns overplotting into shading, so a dense cloud shows where the
# mass actually is rather than a solid block of one colour.
ax.scatter(spend, revenue, alpha=0.3, s=12)`,
  },
  {
    id: "py-plot-annotate",
    title: "Point at the thing the chart is about",
    level: 4,
    tags: ["viz"],
    code: `# One annotation on the interesting point does more than a paragraph
# underneath. The chart should carry its own conclusion.
ax.annotate(
    "Launch",
    xy=("2026-03-01", peak),
    xytext=(10, 20),
    textcoords="offset points",
    arrowprops={"arrowstyle": "->"},
)`,
  },
  {
    id: "py-plot-axis-zero",
    title: "Start a bar axis at zero",
    level: 4,
    tags: ["viz"],
    code: `# A truncated axis on a bar chart exaggerates every difference on it.
# For a line chart showing change over time, truncating is defensible.
ax.set_ylim(bottom=0)`,
  },
  {
    id: "py-plot-save",
    title: "Save at a resolution someone can read",
    level: 2,
    tags: ["viz"],
    code: `# bbox_inches="tight" crops the whitespace that otherwise swallows the
# axis labels when the figure is dropped into a document.
fig.savefig("revenue.png", dpi=200, bbox_inches="tight")`,
  },
  {
    id: "py-plot-seaborn",
    title: "A grouped chart in one call",
    level: 3,
    tags: ["viz"],
    code: `# seaborn takes a tidy frame and column names, so the grouping and the
# legend come for free. It draws onto a matplotlib axis like anything else.
import seaborn as sns

sns.barplot(data=by_month, x="month", y="revenue", hue="country", ax=ax)`,
  },
  {
    id: "py-plot-heatmap",
    title: "A correlation heatmap",
    level: 4,
    tags: ["viz"],
    code: `# A diverging palette centred on zero: positive and negative correlations
# read differently at a glance, which a single-hue scale cannot show.
sns.heatmap(frame.corr(numeric_only=True), cmap="RdBu_r", center=0, annot=True)`,
  },
  {
    id: "py-idiom-fstring",
    title: "Format a number for a human",
    level: 2,
    tags: ["python", "idiom"],
    code: `# The underscore separator and a fixed precision. A raw float in a report
# is the difference between 1234567.8912 and something anyone can read.
print(f"Revenue: {revenue:_.2f} AUD across {orders:_} orders")`,
  },
  {
    id: "py-idiom-comprehension",
    title: "A comprehension instead of a loop",
    level: 2,
    tags: ["python", "idiom"],
    code: `# Shorter, and it says "build a list" up front rather than making the
# reader watch a variable being appended to.
totals = [order["quantity"] * order["price"] for order in orders if order["paid"]]`,
  },
  {
    id: "py-idiom-dict-comprehension",
    title: "Build a lookup",
    level: 3,
    tags: ["python", "idiom"],
    code: `# A dict lookup is constant time; scanning a list for each key is not.
# On anything above a few hundred rows this is the whole difference.
by_id = {customer["id"]: customer for customer in customers}`,
  },
  {
    id: "py-idiom-enumerate-zip",
    title: "Iterate with an index, or over two sequences",
    level: 2,
    tags: ["python", "idiom"],
    code: `# range(len(x)) is the loop nobody needs to write. strict=True makes zip
# raise when the sequences differ in length instead of silently truncating.
for position, (name, score) in enumerate(zip(names, scores, strict=True), start=1):
    print(f"{position}. {name}: {score}")`,
  },
  {
    id: "py-idiom-pathlib",
    title: "Paths as objects",
    level: 3,
    tags: ["python", "idiom"],
    code: `# The / operator builds the path with the right separator for the system,
# so the same code works on Windows without a string-joining bug.
from pathlib import Path

data_dir = Path("data") / "raw"
for csv_path in sorted(data_dir.glob("*.csv")):
    frame = pd.read_csv(csv_path)`,
  },
  {
    id: "py-idiom-dataclass",
    title: "A record type in four lines",
    level: 3,
    tags: ["python", "idiom"],
    code: `# frozen makes it hashable and immutable, so it can go in a set and
# cannot be edited by accident halfway through a pipeline.
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Metric:
    name: str
    value: float
    unit: str = "count"`,
  },
  {
    id: "py-idiom-typing",
    title: "Type hints on a function that returns a frame",
    level: 4,
    tags: ["python", "idiom"],
    code: `# The hints are checked by the reader even when no type checker runs. A
# function taking a DataFrame and returning one should say so.
def summarise(frame: pd.DataFrame, by: list[str]) -> pd.DataFrame:
    """Total revenue and order count for each group in \`by\`."""
    return frame.groupby(by, as_index=False, observed=True).agg(
        revenue=("total", "sum"),
        orders=("order_id", "count"),
    )`,
  },
  {
    id: "py-idiom-context-manager",
    title: "Close what you open",
    level: 2,
    tags: ["python", "idiom"],
    code: `# The with block closes the file even if the code inside raises, which
# a bare open() followed by close() does not.
with open("report.txt", "w", encoding="utf-8") as handle:
    handle.write(summary)`,
  },
  {
    id: "py-idiom-logging",
    title: "Log instead of printing",
    level: 3,
    tags: ["python", "idiom"],
    code: `# The lazy %s form: the string is only built if the message is actually
# emitted, and the level can be turned down without editing the code.
import logging

logger = logging.getLogger(__name__)
logger.info("Loaded %s rows from %s", len(frame), path)`,
  },
  {
    id: "py-idiom-main-guard",
    title: "A script that is also importable",
    level: 3,
    tags: ["python", "idiom"],
    code: `# Without the guard, importing this module to reuse one function runs the
# whole analysis as a side effect.
def main() -> None:
    frame = pd.read_parquet("orders.parquet")
    print(summarise(frame, by=["country"]))


if __name__ == "__main__":
    main()`,
  },
];
