import { type Snippet } from "../types.ts";

/**
 * Loading, reshaping and cleaning data with pandas.
 *
 * The half of a data analyst's day that is not analysis. Written to what `ruff
 * format` leaves behind — double quotes, 88 columns, a trailing comma in any
 * call that had to wrap — because that is the style nearly every Python
 * project settled on once the argument stopped being worth having.
 */
export const pythonPandas: readonly Snippet[] = [
  {
    id: "py-pd-import",
    title: "The imports, with the aliases everyone uses",
    level: 1,
    tags: ["pandas", "basics"],
    code: `# The aliases are effectively part of the API: np and pd appear in every
# tutorial, every answer and every codebase, so renaming them costs more
# than it saves.
import numpy as np
import pandas as pd`,
  },
  {
    id: "py-pd-read-csv",
    title: "Read a CSV without guessing at types",
    level: 2,
    tags: ["pandas", "basics"],
    code: `# Naming the dtypes up front stops pandas inferring them per column, which
# is where a zip code silently becomes an integer and loses its leading zero.
orders = pd.read_csv(
    "orders.csv",
    dtype={"order_id": "string", "postcode": "string", "quantity": "int64"},
    parse_dates=["ordered_at"],
)`,
  },
  {
    id: "py-pd-read-parquet",
    title: "Read only the columns you need",
    level: 2,
    tags: ["pandas", "basics"],
    code: `# Parquet is columnar, so naming the columns means the rest are never read
# off disk at all. On a wide table this is the difference between seconds
# and minutes.
events = pd.read_parquet(
    "events.parquet",
    columns=["profile_id", "event", "occurred_at"],
)`,
  },
  {
    id: "py-pd-inspect",
    title: "The first three things to run on a new frame",
    level: 1,
    tags: ["pandas", "basics"],
    code: `# shape, dtypes and a look at the head, in that order. Skipping this is
# how an analysis gets built on a column that is 90% null.
print(orders.shape)
print(orders.dtypes)
print(orders.head())`,
  },
  {
    id: "py-pd-describe",
    title: "Summary statistics, including the text columns",
    level: 2,
    tags: ["pandas", "basics"],
    code: `# By default describe() only covers numbers. Asking for everything shows
# the cardinality of the categoricals too, which is usually the surprise.
summary = orders.describe(include="all")`,
  },
  {
    id: "py-pd-select",
    title: "Select rows and columns by label",
    level: 2,
    tags: ["pandas", "select"],
    code: `# .loc is label-based and .iloc is position-based. Indexing the frame
# directly works for columns and is ambiguous for everything else, so the
# habit worth forming is to always say which one you mean.
recent = orders.loc[orders["ordered_at"] >= "2026-01-01", ["order_id", "total"]]`,
  },
  {
    id: "py-pd-boolean-mask",
    title: "Combine conditions",
    level: 2,
    tags: ["pandas", "select"],
    code: `# Bitwise & and |, not the words and/or, and every condition in its own
# brackets: & binds tighter than the comparison operators.
large_local = orders[(orders["total"] > 100) & (orders["country"] == "AU")]`,
  },
  {
    id: "py-pd-query",
    title: "The same filter, as a readable expression",
    level: 3,
    tags: ["pandas", "select"],
    code: `# query() takes a string, so the brackets and the & disappear. @ refers to
# a Python variable, which is what makes it usable with a real threshold.
threshold = 100
large_local = orders.query("total > @threshold and country == 'AU'")`,
  },
  {
    id: "py-pd-isin",
    title: "Match against a set of values",
    level: 2,
    tags: ["pandas", "select"],
    code: `# The vectorised form of "one of these". Building the same thing out of
# chained | comparisons is slower and much easier to get wrong.
priority = orders[orders["country"].isin(["AU", "NZ", "SG"])]`,
  },
  {
    id: "py-pd-between",
    title: "A range filter",
    level: 2,
    tags: ["pandas", "select"],
    code: `# Inclusive on both ends by default, which is worth checking against what
# the question actually asked for.
q1 = orders[orders["ordered_at"].between("2026-01-01", "2026-03-31")]`,
  },
  {
    id: "py-pd-assign",
    title: "Add a column without mutating the original",
    level: 3,
    tags: ["pandas", "transform"],
    code: `# assign() returns a new frame, so a chain of them reads top to bottom and
# leaves the input untouched. Later keywords can use earlier ones.
priced = orders.assign(
    net=lambda df: df["total"] - df["tax"],
    margin=lambda df: df["net"] / df["total"],
)`,
  },
  {
    id: "py-pd-chain",
    title: "A whole transformation as one chain",
    level: 4,
    tags: ["pandas", "transform"],
    code: `# No intermediate names means no chance of using a stale one, and the
# outer brackets are what let the chain wrap across lines.
report = (
    orders.query("status == 'complete'")
    .assign(month=lambda df: df["ordered_at"].dt.to_period("M"))
    .groupby("month", as_index=False)["total"]
    .sum()
    .sort_values("month")
)`,
  },
  {
    id: "py-pd-rename",
    title: "Rename columns",
    level: 1,
    tags: ["pandas", "transform"],
    code: `# A dict of old to new. Anything not mentioned keeps its name, so this is
# safe to run against a frame whose exact columns you are unsure of.
orders = orders.rename(columns={"amt": "total", "cty": "country"})`,
  },
  {
    id: "py-pd-astype",
    title: "Convert types, including to categorical",
    level: 3,
    tags: ["pandas", "transform"],
    code: `# category stores the distinct values once and the rows as small integers.
# On a column with few distinct values it can cut memory by an order of
# magnitude and speeds up every groupby that touches it.
orders = orders.astype({"country": "category", "quantity": "int32"})`,
  },
  {
    id: "py-pd-apply-vs-vector",
    title: "Prefer a vectorised expression to apply",
    level: 4,
    tags: ["pandas", "transform", "performance"],
    code: `# apply() runs a Python function per row and is typically 50 to 100 times
# slower. Almost anything expressible in arithmetic should be written this
# way instead.
orders["unit_price"] = orders["total"] / orders["quantity"]`,
  },
  {
    id: "py-pd-where",
    title: "Conditional values without a loop",
    level: 3,
    tags: ["pandas", "transform"],
    code: `# np.where is the vectorised if/else: condition, value if true, value if
# false. It returns an array, so it can be assigned straight to a column.
orders["band"] = np.where(orders["total"] > 100, "large", "small")`,
  },
  {
    id: "py-pd-select-multi",
    title: "More than two branches",
    level: 4,
    tags: ["pandas", "transform"],
    code: `# np.select takes the conditions in priority order and stops at the first
# match, so overlapping conditions are resolved rather than being a bug.
conditions = [orders["total"] > 500, orders["total"] > 100]
labels = ["premium", "large"]
orders["band"] = np.select(conditions, labels, default="small")`,
  },
  {
    id: "py-pd-cut",
    title: "Bin a numeric column",
    level: 3,
    tags: ["pandas", "transform"],
    code: `# The bin edges are exclusive on the left and inclusive on the right, so
# a total of exactly 100 lands in "medium" and not in "small".
orders["size"] = pd.cut(
    orders["total"],
    bins=[0, 100, 500, np.inf],
    labels=["small", "medium", "large"],
)`,
  },
  {
    id: "py-pd-qcut",
    title: "Bin into equal-sized groups",
    level: 3,
    tags: ["pandas", "transform"],
    code: `# qcut splits by count and cut splits by value. Deciles of spend want
# qcut; price brackets that mean something to the business want cut.
orders["decile"] = pd.qcut(orders["total"], q=10, labels=False)`,
  },
  {
    id: "py-pd-groupby-agg",
    title: "Aggregate several ways at once",
    level: 3,
    tags: ["pandas", "aggregate"],
    code: `# Named aggregation: the keyword becomes the column name, so the result
# has no MultiIndex to flatten afterwards.
by_country = orders.groupby("country", as_index=False).agg(
    orders=("order_id", "count"),
    revenue=("total", "sum"),
    average=("total", "mean"),
)`,
  },
  {
    id: "py-pd-groupby-multi",
    title: "Group by more than one column",
    level: 3,
    tags: ["pandas", "aggregate"],
    code: `# observed=True matters once a grouping column is categorical: without it
# pandas returns a row for every unused combination of categories.
by_month = orders.groupby(
    ["country", "status"],
    as_index=False,
    observed=True,
).agg(revenue=("total", "sum"))`,
  },
  {
    id: "py-pd-transform",
    title: "A group statistic on every row",
    level: 4,
    tags: ["pandas", "aggregate"],
    code: `# transform returns something the same length as the input, which is what
# lets a group total sit beside each row — the window function of pandas.
orders["country_total"] = orders.groupby("country")["total"].transform("sum")
orders["share"] = orders["total"] / orders["country_total"]`,
  },
  {
    id: "py-pd-groupby-filter",
    title: "Keep only the groups that qualify",
    level: 4,
    tags: ["pandas", "aggregate"],
    code: `# The equivalent of HAVING: the predicate sees each group as a frame and
# returns one boolean for the whole of it.
busy = orders.groupby("country").filter(lambda g: len(g) >= 100)`,
  },
  {
    id: "py-pd-value-counts",
    title: "Count the distinct values",
    level: 1,
    tags: ["pandas", "aggregate"],
    code: `# dropna=False is the useful part: it counts the nulls as their own row
# rather than pretending the column is complete.
counts = orders["status"].value_counts(dropna=False)`,
  },
  {
    id: "py-pd-crosstab",
    title: "A two-way frequency table",
    level: 3,
    tags: ["pandas", "aggregate"],
    code: `# normalize="index" turns the counts into row percentages, which is what
# makes two countries of very different size comparable.
share = pd.crosstab(orders["country"], orders["status"], normalize="index")`,
  },
  {
    id: "py-pd-pivot-table",
    title: "Pivot rows into columns",
    level: 4,
    tags: ["pandas", "reshape"],
    code: `# fill_value keeps the empty cells as zero. Left as NaN they would turn
# an integer column into a float and every total below it into a surprise.
matrix = orders.pivot_table(
    index="country",
    columns="status",
    values="total",
    aggfunc="sum",
    fill_value=0,
)`,
  },
  {
    id: "py-pd-melt",
    title: "Unpivot columns back into rows",
    level: 4,
    tags: ["pandas", "reshape"],
    code: `# The inverse of a pivot, and the shape almost every plotting library
# actually wants: one row per observation, not one column per series.
tall = matrix.reset_index().melt(
    id_vars="country",
    var_name="status",
    value_name="total",
)`,
  },
  {
    id: "py-pd-stack",
    title: "Move a column level into the index",
    level: 5,
    tags: ["pandas", "reshape"],
    code: `# stack and unstack are melt and pivot for a MultiIndex. Worth knowing
# because a groupby on two keys hands you one whether you asked or not.
tidy = matrix.stack().rename("total").reset_index()`,
  },
  {
    id: "py-pd-merge",
    title: "Join two frames",
    level: 3,
    tags: ["pandas", "join"],
    code: `# validate raises if the relationship is not what you claimed, which
# catches a duplicated key before it silently multiplies your row count.
enriched = orders.merge(
    customers,
    on="customer_id",
    how="left",
    validate="many_to_one",
)`,
  },
  {
    id: "py-pd-merge-indicator",
    title: "See which side each row came from",
    level: 4,
    tags: ["pandas", "join", "quality"],
    code: `# indicator adds a _merge column of left_only, right_only or both. It is
# the fastest way to find out why a join lost rows.
checked = orders.merge(customers, on="customer_id", how="outer", indicator=True)
missing = checked[checked["_merge"] == "left_only"]`,
  },
  {
    id: "py-pd-merge-asof",
    title: "Join on the nearest earlier timestamp",
    level: 5,
    tags: ["pandas", "join", "timeseries"],
    code: `# The as-of join: match each trade to the quote in force at the time. Both
# frames must be sorted on the key, and it will tell you if they are not.
priced = pd.merge_asof(
    trades.sort_values("ts"),
    quotes.sort_values("ts"),
    on="ts",
    by="symbol",
    direction="backward",
)`,
  },
  {
    id: "py-pd-concat",
    title: "Stack frames on top of each other",
    level: 2,
    tags: ["pandas", "join"],
    code: `# ignore_index renumbers the result. Without it the index repeats, and the
# duplicates only cause trouble later, somewhere else.
combined = pd.concat([jan, feb, mar], ignore_index=True)`,
  },
  {
    id: "py-pd-nulls",
    title: "Find where the nulls are",
    level: 2,
    tags: ["pandas", "quality"],
    code: `# The proportion, not the count: 400 nulls means nothing until you know
# whether the frame has 500 rows or five million.
null_share = orders.isna().mean().sort_values(ascending=False)`,
  },
  {
    id: "py-pd-fillna",
    title: "Fill nulls deliberately, per column",
    level: 3,
    tags: ["pandas", "quality"],
    code: `# One value for the whole frame is almost always wrong. A missing total
# is zero; a missing country is unknown, and saying so keeps it visible.
orders = orders.fillna({"total": 0, "country": "unknown"})`,
  },
  {
    id: "py-pd-dropna-subset",
    title: "Drop rows only where it matters",
    level: 3,
    tags: ["pandas", "quality"],
    code: `# Without subset, dropna() removes a row for a null in any column at all,
# which quietly deletes most of a wide frame.
usable = orders.dropna(subset=["order_id", "ordered_at"])`,
  },
  {
    id: "py-pd-duplicates",
    title: "Find the duplicates before dropping them",
    level: 3,
    tags: ["pandas", "quality"],
    code: `# keep=False marks every copy rather than all-but-one, so you can look at
# what is actually duplicated instead of trusting that it was harmless.
dupes = orders[orders.duplicated(subset=["order_id"], keep=False)]
orders = orders.drop_duplicates(subset=["order_id"], keep="last")`,
  },
  {
    id: "py-pd-clip",
    title: "Cap outliers rather than dropping them",
    level: 4,
    tags: ["pandas", "quality"],
    code: `# Winsorising: the extreme rows keep their place in the count and stop
# dominating the mean. Dropping them changes the denominator too.
low, high = orders["total"].quantile([0.01, 0.99])
orders["total_capped"] = orders["total"].clip(lower=low, upper=high)`,
  },
  {
    id: "py-pd-string-clean",
    title: "Clean a text column",
    level: 3,
    tags: ["pandas", "quality"],
    code: `# The .str accessor is vectorised and null-safe. Chaining it beats apply()
# on speed and beats a loop on both speed and legibility.
orders["email"] = orders["email"].str.strip().str.lower()`,
  },
  {
    id: "py-pd-string-extract",
    title: "Pull fields out of a string column",
    level: 4,
    tags: ["pandas", "quality"],
    code: `# Each capture group becomes a column, and a row that does not match gets
# nulls rather than raising — so check for them afterwards.
parts = orders["reference"].str.extract(r"(?P<region>[A-Z]{2})-(?P<seq>\\d+)")`,
  },
  {
    id: "py-pd-datetime",
    title: "Parse dates, and admit when one will not parse",
    level: 3,
    tags: ["pandas", "timeseries"],
    code: `# errors="coerce" turns an unparseable value into NaT instead of raising,
# which lets you count them and decide, rather than losing the whole load.
orders["ordered_at"] = pd.to_datetime(orders["ordered_at"], errors="coerce")
print(orders["ordered_at"].isna().sum(), "unparseable dates")`,
  },
  {
    id: "py-pd-dt-accessor",
    title: "Date parts as columns",
    level: 2,
    tags: ["pandas", "timeseries"],
    code: `# The .dt accessor mirrors .str: it works on the whole column at once and
# gives you every component of a timestamp.
orders["year"] = orders["ordered_at"].dt.year
orders["weekday"] = orders["ordered_at"].dt.day_name()`,
  },
  {
    id: "py-pd-resample",
    title: "Roll a time series up to a coarser interval",
    level: 4,
    tags: ["pandas", "timeseries"],
    code: `# resample is groupby for time. It fills in the intervals that have no
# rows, which is exactly what a chart of daily revenue needs.
daily = orders.set_index("ordered_at").resample("D")["total"].sum()`,
  },
  {
    id: "py-pd-rolling",
    title: "A rolling average",
    level: 4,
    tags: ["pandas", "timeseries"],
    code: `# min_periods=7 leaves the first six days as NaN rather than averaging
# two days and labelling the result a weekly figure.
daily_avg = daily.rolling(window=7, min_periods=7).mean()`,
  },
  {
    id: "py-pd-shift",
    title: "Compare a period with the one before",
    level: 4,
    tags: ["pandas", "timeseries"],
    code: `# shift is lag. On a grouped frame it must be done inside the group, or
# the first row of each group borrows the last row of the previous one.
monthly["previous"] = monthly.groupby("country")["revenue"].shift(1)
monthly["growth"] = monthly["revenue"] / monthly["previous"] - 1`,
  },
  {
    id: "py-pd-cumulative",
    title: "A running total within each group",
    level: 4,
    tags: ["pandas", "timeseries"],
    code: `# Sort first: cumsum follows the order of the rows, not the order of the
# dates, and an unsorted frame gives a plausible and wrong answer.
monthly = monthly.sort_values(["country", "month"])
monthly["cumulative"] = monthly.groupby("country")["revenue"].cumsum()`,
  },
  {
    id: "py-pd-rank",
    title: "Rank within each group",
    level: 4,
    tags: ["pandas", "aggregate"],
    code: `# method="dense" leaves no gaps after a tie; "min" does. Which one is
# right depends entirely on how the result will be read.
orders["rank"] = orders.groupby("country")["total"].rank(
    method="dense",
    ascending=False,
)`,
  },
  {
    id: "py-pd-nlargest",
    title: "The top N per group",
    level: 4,
    tags: ["pandas", "aggregate"],
    code: `# Faster than sorting the whole frame, and it says what it means. The
# reset_index tidies away the group level the operation leaves behind.
top = (
    orders.groupby("country")[["order_id", "total"]]
    .apply(lambda g: g.nlargest(3, "total"))
    .reset_index(drop=True)
)`,
  },
  {
    id: "py-pd-memory",
    title: "Find out what a frame actually costs",
    level: 4,
    tags: ["pandas", "performance"],
    code: `# deep=True is the point: without it, object columns report the size of
# the pointers and not of the strings they point at.
usage = orders.memory_usage(deep=True).sum() / 1024**2
print(f"{usage:.1f} MB")`,
  },
  {
    id: "py-pd-downcast",
    title: "Shrink the numeric columns",
    level: 5,
    tags: ["pandas", "performance"],
    code: `# int64 holds numbers up to nine quintillion. A quantity column almost
# never needs more than int16, and the saving is eightfold.
orders["quantity"] = pd.to_numeric(orders["quantity"], downcast="integer")`,
  },
  {
    id: "py-pd-chunks",
    title: "Process a file too large to hold",
    level: 5,
    tags: ["pandas", "performance"],
    code: `# The reader yields frames, so the aggregate is built up a chunk at a
# time and memory stays flat regardless of how big the file is.
totals = []
with pd.read_csv("events.csv", chunksize=100_000) as reader:
    for chunk in reader:
        totals.append(chunk.groupby("event", observed=True)["value"].sum())
result = pd.concat(totals).groupby(level=0).sum()`,
  },
  {
    id: "py-pd-to-parquet",
    title: "Write the result back out",
    level: 2,
    tags: ["pandas", "basics"],
    code: `# index=False unless the index carries meaning: a rewritten default
# RangeIndex is a column of row numbers nobody asked for.
report.to_parquet("report.parquet", index=False, compression="zstd")`,
  },
];
