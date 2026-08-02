import { type Snippet } from "../types.ts";

/**
 * Java, on a recent LTS.
 *
 * Records, sealed interfaces, pattern matching in switch, text blocks and
 * `var` — the language has changed more since 17 than in the decade before it,
 * and most Java corpora are still teaching Java 8. The Selenium corpus covers
 * the testing side; this one is the language itself.
 *
 * Checked by google-java-format, which has no options at all: two-space
 * indent, 100 columns, and one way to break a long expression.
 */
export const javaLang: readonly Snippet[] = [
  {
    id: "jv-var",
    title: "var, for a local whose type is obvious",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// Locals only — never a field, a parameter or a return. Useful where the
// right-hand side already names the type, and unhelpful where it does not.
var orders = new ArrayList<Order>();
var total = BigDecimal.ZERO;`,
  },
  {
    id: "jv-final",
    title: "final, where it earns its keep",
    level: 2,
    tags: ["basics"],
    scope: "member",
    code: `// On a field it is a real guarantee; on a local it is documentation.
// Most teams use it on fields always and on locals never.
private final OrderRepository repository;`,
  },
  {
    id: "jv-text-block",
    title: "A text block",
    level: 3,
    tags: ["basics"],
    scope: "member",
    code: `// Incidental indentation is stripped relative to the closing delimiter,
// so the SQL below starts at column zero however far in the block sits.
String query =
    """
    SELECT order_id, total
    FROM orders
    WHERE status = 'paid'
    """;`,
  },
  {
    id: "jv-record",
    title: "A record",
    level: 3,
    tags: ["types"],
    code: `// equals, hashCode, toString and the accessors, generated. For anything
// that is data rather than behaviour, this replaces sixty lines.
public record Order(String id, int quantity, BigDecimal total) {}`,
  },
  {
    id: "jv-record-compact",
    title: "Validate inside a record",
    level: 4,
    tags: ["types"],
    code: `// The compact constructor runs before the fields are assigned, so this
// is where an invariant belongs — and it cannot be bypassed.
public record Order(String id, int quantity) {
  public Order {
    Objects.requireNonNull(id, "id");
    if (quantity < 1) {
      throw new IllegalArgumentException("quantity must be at least 1");
    }
  }
}`,
  },
  {
    id: "jv-sealed",
    title: "A sealed interface",
    level: 4,
    tags: ["types"],
    code: `// The compiler knows every implementation, which is what makes the switch
// below exhaustive without a default branch.
public sealed interface Result permits Success, Failure, Loading {}`,
  },
  {
    id: "jv-switch-pattern",
    title: "Pattern matching in a switch",
    level: 4,
    tags: ["patterns"],
    scope: "member",
    code: `// Each label binds the value at its own type, so there is no cast. Over a
// sealed type the compiler checks every case is covered.
String describe(Result result) {
  return switch (result) {
    case Success s -> s.orders().size() + " orders";
    case Failure f -> "Failed: " + f.message();
    case Loading ignored -> "Loading…";
  };
}`,
  },
  {
    id: "jv-switch-arrow",
    title: "The arrow form does not fall through",
    level: 3,
    tags: ["patterns"],
    scope: "member",
    code: `// No break, no accidental fall-through, and it is an expression — which
// is what lets the whole thing be assigned.
int days =
    switch (month) {
      case FEBRUARY -> 28;
      case APRIL, JUNE, SEPTEMBER, NOVEMBER -> 30;
      default -> 31;
    };`,
  },
  {
    id: "jv-instanceof-pattern",
    title: "instanceof, with the binding built in",
    level: 3,
    tags: ["patterns"],
    scope: "statement",
    code: `// The variable is in scope wherever the check is known to have passed,
// which removes the cast that used to follow every instanceof.
if (value instanceof String text && !text.isBlank()) {
  return text.strip();
}`,
  },
  {
    id: "jv-optional",
    title: "Optional, as a return type",
    level: 3,
    tags: ["nullability"],
    scope: "member",
    code: `// For a return that may legitimately be empty. Not for a field and not
// for a parameter — it is a poor null and a worse container.
Optional<Order> findById(String id);`,
  },
  {
    id: "jv-optional-chain",
    title: "Work with an Optional without unwrapping it",
    level: 3,
    tags: ["nullability"],
    scope: "member",
    code: `// Calling get() without isPresent() is the mistake Optional exists to
// prevent, and orElse says what happens instead in the same breath.
String country = findById(id).map(Order::country).orElse("unknown");`,
  },
  {
    id: "jv-objects-require",
    title: "Fail fast on a null argument",
    level: 2,
    tags: ["nullability"],
    scope: "statement",
    code: `// The message names the parameter, so the NullPointerException says
// which one — which the unassisted version never does.
this.repository = Objects.requireNonNull(repository, "repository");`,
  },
  {
    id: "jv-stream-filter-map",
    title: "A stream",
    level: 3,
    tags: ["streams"],
    scope: "member",
    code: `// Lazy until the terminal operation, and it reads in the order the work
// happens — which a nested loop does not.
List<String> ids =
    orders.stream()
        .filter(order -> order.total().compareTo(THRESHOLD) > 0)
        .map(Order::id)
        .toList();`,
  },
  {
    id: "jv-stream-collect-group",
    title: "Group and total",
    level: 4,
    tags: ["streams"],
    scope: "statement",
    code: `// groupingBy with a downstream collector: the equivalent of a SQL GROUP
// BY, in one expression.
Map<String, BigDecimal> revenue =
    orders.stream()
        .collect(
            Collectors.groupingBy(
                Order::country,
                Collectors.reducing(BigDecimal.ZERO, Order::total, BigDecimal::add)));`,
  },
  {
    id: "jv-stream-tolist",
    title: "toList, not collect(toList())",
    level: 3,
    tags: ["streams"],
    scope: "member",
    code: `// Shorter, and it returns an unmodifiable list — which is what most code
// wanted and almost never asked for.
List<Order> paid = orders.stream().filter(Order::isPaid).toList();`,
  },
  {
    id: "jv-stream-optional",
    title: "A stream that may find nothing",
    level: 3,
    tags: ["streams"],
    scope: "member",
    code: `// findFirst returns an Optional because an empty result is normal, and
// the type says so rather than leaving a null to be discovered later.
Optional<Order> largest = orders.stream().max(Comparator.comparing(Order::total));`,
  },
  {
    id: "jv-comparator",
    title: "Sort by two things",
    level: 4,
    tags: ["streams"],
    scope: "statement",
    code: `// comparing then thenComparing, with reversed applied to the whole chain
// rather than to one key — which is where this usually goes wrong.
orders.sort(Comparator.comparing(Order::country).thenComparing(Order::total).reversed());`,
  },
  {
    id: "jv-collections-factory",
    title: "Immutable collections, in one call",
    level: 2,
    tags: ["collections"],
    scope: "member",
    code: `// Unmodifiable, null-hostile, and shorter than the alternatives. copyOf
// makes a defensive copy of something you were handed.
List<String> countries = List.of("AU", "NZ", "SG");
Map<String, Integer> limits = Map.of("basic", 1, "premium", 10);`,
  },
  {
    id: "jv-map-compute",
    title: "Update a map entry in one lookup",
    level: 4,
    tags: ["collections"],
    scope: "statement",
    code: `// computeIfAbsent and merge each hash the key once, where a get followed
// by a put hashes it twice and leaves room for a race.
counts.merge(order.country(), 1, Integer::sum);
index.computeIfAbsent(order.country(), key -> new ArrayList<>()).add(order);`,
  },
  {
    id: "jv-iterator-remove",
    title: "Remove while iterating",
    level: 4,
    tags: ["collections"],
    scope: "statement",
    code: `// Removing inside a for-each throws ConcurrentModificationException.
// removeIf does the same thing safely and says what it means.
orders.removeIf(order -> order.total().signum() == 0);`,
  },
  {
    id: "jv-try-with-resources",
    title: "try-with-resources",
    level: 3,
    tags: ["errors"],
    scope: "statement",
    code: `// Closed in reverse order, even on an exception, and a failure to close
// is added as a suppressed exception rather than hiding the original.
try (var reader = Files.newBufferedReader(path)) {
  return reader.lines().toList();
}`,
  },
  {
    id: "jv-exception-cause",
    title: "Wrap an exception, keeping the cause",
    level: 3,
    tags: ["errors"],
    scope: "statement",
    code: `// Dropping the cause is the most common logging mistake in Java: the
// stack trace then points at the wrapper and not at what actually failed.
try {
  return repository.find(id);
} catch (SQLException e) {
  throw new RepositoryException("finding order " + id, e);
}`,
  },
  {
    id: "jv-checked-unchecked",
    title: "Which exception to throw",
    level: 4,
    tags: ["errors"],
    code: `// A checked exception for something the caller can reasonably recover
// from; unchecked for a programming error. Most modern code leans unchecked.
public class OrderNotFoundException extends RuntimeException {
  public OrderNotFoundException(String id) {
    super("Order " + id + " was not found");
  }
}`,
  },
  {
    id: "jv-equals-hashcode",
    title: "equals and hashCode travel together",
    level: 4,
    tags: ["types"],
    scope: "member",
    code: `// Overriding one without the other breaks every hash-based collection
// silently. A record generates both, which is the better answer.
@Override
public boolean equals(Object other) {
  return other instanceof Sku sku && value.equals(sku.value);
}

@Override
public int hashCode() {
  return Objects.hash(value);
}`,
  },
  {
    id: "jv-builder",
    title: "A builder",
    level: 5,
    tags: ["types"],
    scope: "member",
    code: `// For a type with many optional fields, where a constructor would be six
// parameters of the same type in an order nobody can remember.
public static final class Builder {
  private String id;
  private int quantity = 1;

  public Builder id(String id) {
    this.id = id;
    return this;
  }

  public Order build() {
    return new Order(id, quantity);
  }
}`,
  },
  {
    id: "jv-generic-method",
    title: "A generic method with a bound",
    level: 4,
    tags: ["generics"],
    scope: "member",
    code: `// The bound is what makes the body legal: without Comparable there is no
// compareTo to call.
static <T extends Comparable<T>> T largest(List<T> values) {
  return values.stream().max(Comparator.naturalOrder()).orElseThrow();
}`,
  },
  {
    id: "jv-wildcard",
    title: "The wildcards, and which way round",
    level: 5,
    tags: ["generics"],
    scope: "member",
    code: `// Producer extends, consumer super. A list you only read from takes
// extends; one you only write into takes super.
void copy(List<? extends Order> from, List<? super Order> into) {
  into.addAll(from);
}`,
  },
  {
    id: "jv-functional-interface",
    title: "A functional interface",
    level: 4,
    tags: ["generics"],
    code: `// One abstract method, so it can be written as a lambda. The annotation
// makes the compiler check that, which stops a second method sneaking in.
@FunctionalInterface
public interface OrderFilter {
  boolean matches(Order order);
}`,
  },
  {
    id: "jv-method-reference",
    title: "A method reference",
    level: 3,
    tags: ["streams"],
    scope: "statement",
    code: `// Four kinds: static, bound, unbound, and constructor. Shorter than the
// lambda, and it names the operation rather than restating it.
orders.stream().map(Order::id).forEach(System.out::println);`,
  },
  {
    id: "jv-completable-future",
    title: "Two calls at once",
    level: 5,
    tags: ["concurrency"],
    scope: "statement",
    code: `// Both start immediately and join waits for whichever finishes last, so
// the total is the slower rather than the sum.
var ordersFuture = CompletableFuture.supplyAsync(this::loadOrders);
var profileFuture = CompletableFuture.supplyAsync(this::loadProfile);
render(ordersFuture.join(), profileFuture.join());`,
  },
  {
    id: "jv-virtual-thread",
    title: "A virtual thread per task",
    level: 5,
    tags: ["concurrency"],
    scope: "statement",
    code: `// Cheap enough to create one per request. Blocking on IO parks the
// virtual thread instead of the platform thread underneath it.
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
  ids.forEach(id -> executor.submit(() -> process(id)));
}`,
  },
  {
    id: "jv-bigdecimal",
    title: "Money is not a double",
    level: 3,
    tags: ["basics"],
    scope: "statement",
    code: `// A double cannot hold 0.1 exactly, so money arithmetic drifts. Note the
// String constructor: new BigDecimal(0.1) puts the error straight back.
BigDecimal total = new BigDecimal("51.25").setScale(2, RoundingMode.HALF_UP);`,
  },
];
