import { type Snippet } from "../types.ts";

/**
 * Kotlin, as it is written today.
 *
 * Android's default language since 2019 and increasingly a server one, so the
 * corpus covers both: null safety and data classes because they are what makes
 * the language feel different from Java, and coroutines because they are what
 * most people come to it for.
 *
 * Checked by ktlint on the official code style — four spaces, 100 columns, and
 * the trailing comma that Kotlin adopted after most languages had given up
 * arguing about it.
 */
export const kotlinLang: readonly Snippet[] = [
  {
    id: "kt-val-var",
    title: "val and var",
    level: 1,
    tags: ["basics"],
    code: `// val is a read-only reference and var is not. Reaching for val first
// and relaxing it only when the compiler complains is the usual habit.
val name = "Ada"
var attempts = 0`,
  },
  {
    id: "kt-fun",
    title: "A function, and the expression form",
    level: 1,
    tags: ["basics"],
    code: `// A single-expression body needs no braces and no return, and the return
// type can be inferred — though naming it on a public function is kinder.
fun double(value: Int): Int = value * 2`,
  },
  {
    id: "kt-default-named",
    title: "Default and named arguments",
    level: 2,
    tags: ["basics"],
    code: `// Between them these remove most of the reason to write an overload, and
// the call site says which argument is which.
fun greet(
    name: String,
    greeting: String = "Hello",
    excited: Boolean = false,
) {
    val mark = if (excited) "!" else "."
    println("$greeting, $name$mark")
}`,
  },
  {
    id: "kt-string-template",
    title: "String templates",
    level: 1,
    tags: ["basics"],
    code: `// A bare name needs no braces; anything with a dot or a call does. This
// is the reason Kotlin code rarely contains a concatenation operator.
println("$name has $attempts attempts, \${attempts * 2} points")`,
  },
  {
    id: "kt-nullable",
    title: "Nullable types, declared",
    level: 2,
    tags: ["null"],
    code: `// A type without a question mark cannot hold null, and the compiler
// enforces it. That single rule is what removes the class of bug.
var middleName: String? = null
val surname: String = "Lovelace"`,
  },
  {
    id: "kt-safe-call",
    title: "The safe call and the elvis operator",
    level: 2,
    tags: ["null"],
    code: `// ?. gives null instead of throwing, and ?: supplies the fallback. The
// pair replaces the four-line null check that Java needs.
val length = middleName?.length ?: 0`,
  },
  {
    id: "kt-let",
    title: "Do something only when it is not null",
    level: 3,
    tags: ["null"],
    code: `// let runs the block with the value as \`it\`, and the safe call means it
// does not run at all when the value is null.
middleName?.let { println("Middle name is $it") }`,
  },
  {
    id: "kt-elvis-return",
    title: "Return early on a null",
    level: 4,
    tags: ["null"],
    code: `// The elvis operator can take a return or a throw on its right, which
// turns a guard clause into one line and narrows the type below it.
fun initials(user: User): String {
    val middle = user.middleName ?: return "\${user.first.first()}\${user.last.first()}"
    return "\${user.first.first()}\${middle.first()}\${user.last.first()}"
}`,
  },
  {
    id: "kt-not-null-assert",
    title: "!!, and why it is a last resort",
    level: 4,
    tags: ["null"],
    code: `// !! throws if the value is null, which is exactly the exception the
// type system was there to prevent. Every use is a claim you cannot check.
val definitely = middleName!!`,
  },
  {
    id: "kt-smart-cast",
    title: "Smart casts",
    level: 3,
    tags: ["null", "basics"],
    code: `// After the check the compiler knows the type, so no cast is needed —
// provided the reference is a val and cannot change underneath it.
fun describe(value: Any): String {
    if (value is String) {
        return "a string of \${value.length} characters"
    }
    return "something else"
}`,
  },
  {
    id: "kt-data-class",
    title: "A data class",
    level: 2,
    tags: ["types"],
    code: `// equals, hashCode, toString and copy, generated from the properties in
// the constructor. This is the line that replaces a page of Java.
data class Order(
    val id: String,
    val quantity: Int,
    val total: Double,
)`,
  },
  {
    id: "kt-copy",
    title: "Change one field of an immutable object",
    level: 3,
    tags: ["types"],
    code: `// copy takes named arguments for what changes and keeps the rest, which
// is how immutable data is updated without a builder.
val discounted = order.copy(total = order.total * 0.9)`,
  },
  {
    id: "kt-destructure",
    title: "Destructure a data class",
    level: 3,
    tags: ["types"],
    code: `// The components come from the constructor in order, so this is position
// based — renaming is free, reordering the constructor is not.
val (id, quantity, total) = order`,
  },
  {
    id: "kt-sealed",
    title: "A sealed hierarchy",
    level: 4,
    tags: ["types"],
    code: `// The compiler knows every subclass, so a when over them needs no else
// branch — and stops compiling the day somebody adds a fourth state.
sealed interface Result {
    data class Success(
        val orders: List<Order>,
    ) : Result

    data class Failure(
        val message: String,
    ) : Result

    data object Loading : Result
}`,
  },
  {
    id: "kt-when-sealed",
    title: "Exhaustive when over a sealed type",
    level: 4,
    tags: ["types", "control"],
    code: `// No else, on purpose. Adding a state to the interface above turns this
// into a compile error rather than a branch that silently does nothing.
fun render(result: Result): String =
    when (result) {
        is Result.Success -> "\${result.orders.size} orders"
        is Result.Failure -> "Failed: \${result.message}"
        Result.Loading -> "Loading…"
    }`,
  },
  {
    id: "kt-when-expression",
    title: "when as an expression",
    level: 2,
    tags: ["control"],
    code: `// Kotlin has no ternary because when covers it, and the arrow form reads
// as a table of cases rather than a chain of conditions.
val band =
    when {
        total > 500 -> "premium"
        total > 100 -> "large"
        else -> "small"
    }`,
  },
  {
    id: "kt-enum",
    title: "An enum with behaviour",
    level: 3,
    tags: ["types"],
    code: `// Constructor arguments on the constants, so the values live beside the
// names instead of in a when somewhere else.
enum class Plan(
    val monthlyPrice: Double,
) {
    BASIC(7.99),
    STANDARD(12.99),
    PREMIUM(19.99),
}`,
  },
  {
    id: "kt-list-ops",
    title: "The collection operations you reach for daily",
    level: 2,
    tags: ["collections"],
    code: `// Read left to right as a sentence. Each step returns a new list, so
// nothing above is mutated.
val names =
    orders
        .filter { it.total > 100 }
        .sortedByDescending { it.total }
        .map { it.id }`,
  },
  {
    id: "kt-group-by",
    title: "Group and summarise",
    level: 3,
    tags: ["collections"],
    code: `// groupBy gives a map of key to list; mapValues then reduces each list.
// Together they are the Kotlin spelling of a GROUP BY.
val revenueByCountry =
    orders
        .groupBy { it.country }
        .mapValues { (_, group) -> group.sumOf { it.total } }`,
  },
  {
    id: "kt-associate-by",
    title: "Build a lookup",
    level: 3,
    tags: ["collections"],
    code: `// associateBy keys the map by the selector and keeps the whole element
// as the value. A later duplicate key silently wins, so keys must be unique.
val ordersById = orders.associateBy { it.id }`,
  },
  {
    id: "kt-partition-fold",
    title: "Split in two, and fold to one",
    level: 4,
    tags: ["collections"],
    code: `// partition returns both halves rather than filtering the list twice,
// and fold carries an accumulator through without a mutable variable.
val (paid, unpaid) = orders.partition { it.isPaid }
val total = paid.fold(0.0) { sum, order -> sum + order.total }`,
  },
  {
    id: "kt-sequence",
    title: "A lazy chain over a large collection",
    level: 5,
    tags: ["collections"],
    code: `// A plain chain builds an intermediate list at every step. asSequence
// pulls one element through the whole chain at a time, and first() stops
// as soon as it has an answer.
val firstLarge =
    orders
        .asSequence()
        .filter { it.total > 100 }
        .map { it.id }
        .firstOrNull()`,
  },
  {
    id: "kt-scope-apply",
    title: "apply, for configuring an object",
    level: 3,
    tags: ["idiom"],
    code: `// apply runs the block with the object as the receiver and returns the
// object, which is what makes it a builder without a builder class.
val request =
    Request().apply {
        url = "https://example.com/api/orders"
        method = "POST"
        timeout = 30
    }`,
  },
  {
    id: "kt-scope-also-run",
    title: "The rest of the scope functions",
    level: 4,
    tags: ["idiom"],
    code: `// also returns the receiver and is for side effects; run returns the
// block's result. Choosing by what you want back is the whole rule.
val saved = order.also { logger.info("saving \${it.id}") }
val summary = order.run { "$id: $quantity items" }`,
  },
  {
    id: "kt-extension",
    title: "An extension function",
    level: 3,
    tags: ["idiom"],
    code: `// Adds a method to a type you do not own, resolved statically. It is how
// Kotlin avoids the StringUtils class that every Java project grows.
fun String.toSlug(): String = trim().lowercase().replace(Regex("[^a-z0-9]+"), "-")`,
  },
  {
    id: "kt-infix",
    title: "An infix function",
    level: 5,
    tags: ["idiom"],
    code: `// One parameter, no dot and no brackets at the call site. Worth it for
// something that genuinely reads as a phrase, and confusing otherwise.
infix fun Int.percentOf(total: Int): Double = this * 100.0 / total`,
  },
  {
    id: "kt-result",
    title: "Return a failure without throwing",
    level: 4,
    tags: ["errors"],
    code: `// runCatching wraps the throw into a Result, and getOrElse unwraps it
// with a fallback — so the error is a value the caller has to handle.
val orders = runCatching { api.fetchOrders() }.getOrElse { emptyList() }`,
  },
  {
    id: "kt-require-check",
    title: "State a precondition",
    level: 3,
    tags: ["errors"],
    code: `// require for arguments and check for state, each throwing the matching
// exception. The message is built lazily, so it costs nothing when it holds.
fun withdraw(amount: Double) {
    require(amount > 0) { "amount must be positive, was $amount" }
    check(balance >= amount) { "insufficient funds" }
}`,
  },
  {
    id: "kt-coroutine-launch",
    title: "Start a coroutine",
    level: 4,
    tags: ["coroutines"],
    code: `// Structured concurrency: the scope owns the coroutine, and cancelling
// the scope cancels everything started inside it. Nothing leaks.
scope.launch {
    val orders = repository.fetchOrders()
    state.value = Result.Success(orders)
}`,
  },
  {
    id: "kt-coroutine-async",
    title: "Run two calls at once",
    level: 5,
    tags: ["coroutines"],
    code: `// async starts both immediately and await collects them, so the total
// wait is the slower of the two rather than the sum.
coroutineScope {
    val orders = async { api.fetchOrders() }
    val profile = async { api.fetchProfile() }
    render(orders.await(), profile.await())
}`,
  },
  {
    id: "kt-suspend",
    title: "A suspending function",
    level: 4,
    tags: ["coroutines"],
    code: `// suspend means it can pause without blocking a thread. withContext
// moves the work to the IO dispatcher and moves the result back.
suspend fun fetchOrders(): List<Order> =
    withContext(Dispatchers.IO) {
        api.getOrders().body() ?: emptyList()
    }`,
  },
  {
    id: "kt-flow",
    title: "A stream of values over time",
    level: 5,
    tags: ["coroutines"],
    code: `// A flow is cold: nothing runs until it is collected, and the operators
// in between are suspending rather than blocking.
fun orderUpdates(): Flow<Order> =
    flow {
        while (true) {
            emit(api.latestOrder())
            delay(5_000)
        }
    }.distinctUntilChanged()`,
  },
];
