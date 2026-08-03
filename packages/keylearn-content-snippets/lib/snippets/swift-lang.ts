import { type Snippet } from "../types.ts";

/**
 * Swift, as it is written today.
 *
 * Modern Swift rather than the Objective-C-shaped Swift of 2015: optionals
 * handled with `guard let`, errors as thrown values, concurrency with
 * async/await and actors, and enough SwiftUI to be recognisable.
 *
 * Checked by `swift-format`, which Apple ships inside the toolchain — so on a
 * Mac with the command line tools installed this gate always runs, whether or
 * not anything else has been set up.
 */
export const swiftLang: readonly Snippet[] = [
  {
    id: "sw-let-var",
    title: "let and var",
    level: 1,
    tags: ["basics"],
    code: `// let is a constant. Swift will warn about a var that is never
// reassigned, which is a nudge worth taking rather than silencing.
let name = "Ada"
var attempts = 0`,
  },
  {
    id: "sw-func",
    title: "A function, with its argument labels",
    level: 2,
    tags: ["basics"],
    code: `// The external label and the internal name are separate, which is why
// Swift call sites read as sentences. An underscore removes the label.
func move(from origin: Point, to destination: Point) -> Double {
  return origin.distance(to: destination)
}`,
  },
  {
    id: "sw-defaults",
    title: "Default parameter values",
    level: 2,
    tags: ["basics"],
    code: `// One function instead of three overloads, and the call site still says
// which argument is which.
func greet(_ name: String, greeting: String = "Hello", excited: Bool = false) {
  print("\\(greeting), \\(name)\\(excited ? "!" : ".")")
}`,
  },
  {
    id: "sw-interpolation",
    title: "String interpolation",
    level: 1,
    tags: ["basics"],
    code: `// Any expression goes inside the parentheses, and a format specifier is
// not one of them — for that, reach for a formatter.
print("\\(name) has \\(attempts) attempts, \\(attempts * 2) points")`,
  },
  {
    id: "sw-optional",
    title: "Optionals, declared",
    level: 2,
    tags: ["optionals"],
    code: `// A type without a question mark cannot be nil, and the compiler holds
// you to it. Everything below follows from that one rule.
var middleName: String? = nil
let surname: String = "Lovelace"`,
  },
  {
    id: "sw-if-let",
    title: "Unwrap with if let",
    level: 2,
    tags: ["optionals"],
    code: `// The shorthand form, where the unwrapped constant takes the same name,
// is now the idiomatic spelling.
if let middleName {
  print("Middle name is \\(middleName)")
}`,
  },
  {
    id: "sw-guard-let",
    title: "guard let, and why it is the better default",
    level: 3,
    tags: ["optionals"],
    code: `// The unwrapped value stays in scope for the rest of the function, so
// the happy path is not indented inside a pyramid of ifs.
func initials(for user: User) -> String? {
  guard let first = user.firstName.first else { return nil }
  guard let last = user.lastName.first else { return nil }
  return "\\(first)\\(last)"
}`,
  },
  {
    id: "sw-nil-coalescing",
    title: "The nil-coalescing operator",
    level: 2,
    tags: ["optionals"],
    code: `// The right-hand side is only evaluated when the left is nil, so an
// expensive default costs nothing in the usual case.
let displayName = middleName ?? "(none)"`,
  },
  {
    id: "sw-optional-chaining",
    title: "Optional chaining",
    level: 3,
    tags: ["optionals"],
    code: `// The whole expression becomes optional the moment one link is, which
// is why the result here is Int? and not Int.
let count = user.profile?.orders?.count ?? 0`,
  },
  {
    id: "sw-force-unwrap",
    title: "The exclamation mark, and its cost",
    level: 4,
    tags: ["optionals"],
    code: `// A force unwrap crashes on nil. It is a promise to the compiler that
// you cannot be checked on, so every one should be justifiable in a line.
let definitely = middleName!`,
  },
  {
    id: "sw-struct",
    title: "A struct",
    level: 2,
    tags: ["types"],
    code: `// Value semantics: assigning one copies it, so nothing else can change
// it behind your back. Reach for a struct before a class.
struct Order {
  let id: String
  let quantity: Int
  var total: Double
}`,
  },
  {
    id: "sw-mutating",
    title: "A method that changes the value",
    level: 3,
    tags: ["types"],
    code: `// A struct's methods cannot alter its properties unless they say so,
// which makes every mutation visible at the point of declaration.
extension Order {
  mutating func applyDiscount(_ fraction: Double) {
    total *= (1 - fraction)
  }
}`,
  },
  {
    id: "sw-computed",
    title: "A computed property",
    level: 2,
    tags: ["types"],
    code: `// No storage: it is derived every time it is read, so it can never
// disagree with the values it is derived from.
extension Order {
  var unitPrice: Double {
    quantity > 0 ? total / Double(quantity) : 0
  }
}`,
  },
  {
    id: "sw-enum-associated",
    title: "An enum with associated values",
    level: 4,
    tags: ["types"],
    code: `// Each case carries its own data, so an impossible combination — a
// success with an error message — cannot be constructed at all.
enum LoadState {
  case loading
  case loaded([Order])
  case failed(Error)
}`,
  },
  {
    id: "sw-switch-exhaustive",
    title: "An exhaustive switch",
    level: 3,
    tags: ["types", "control"],
    code: `// No default, deliberately. Adding a case to the enum above turns this
// into a compile error rather than a branch that quietly does nothing.
switch state {
case .loading:
  return "Loading…"
case .loaded(let orders):
  return "\\(orders.count) orders"
case .failed(let error):
  return "Failed: \\(error.localizedDescription)"
}`,
  },
  {
    id: "sw-switch-where",
    title: "Pattern matching with a condition",
    level: 4,
    tags: ["control"],
    code: `// Ranges and where clauses in the patterns, so the branching reads as a
// table rather than as a chain of else-ifs.
switch total {
case ..<100:
  band = "small"
case 100..<500:
  band = "large"
case let value where value.isNaN:
  band = "unknown"
default:
  band = "premium"
}`,
  },
  {
    id: "sw-protocol",
    title: "A protocol",
    level: 3,
    tags: ["protocols"],
    code: `// The Swift equivalent of an interface, and the unit that most of the
// standard library is built out of.
protocol OrderRepository {
  func fetchOrders() async throws -> [Order]
  func save(_ order: Order) async throws
}`,
  },
  {
    id: "sw-protocol-extension",
    title: "A default implementation",
    level: 4,
    tags: ["protocols"],
    code: `// An extension on the protocol gives every conformer the method for
// free, which is what protocol-oriented programming actually means.
extension OrderRepository {
  func fetchRecent(limit: Int = 10) async throws -> [Order] {
    Array(try await fetchOrders().prefix(limit))
  }
}`,
  },
  {
    id: "sw-generic",
    title: "A generic function with a constraint",
    level: 4,
    tags: ["protocols"],
    code: `// The constraint is what makes the body legal: without Comparable there
// is no < to call, and the compiler says so rather than failing later.
func maximum<T: Comparable>(_ values: [T]) -> T? {
  values.reduce(nil) { best, value in
    guard let best else { return value }
    return value > best ? value : best
  }
}`,
  },
  {
    id: "sw-codable",
    title: "Decode JSON",
    level: 3,
    tags: ["types"],
    code: `// Conforming to Codable is usually the whole implementation. The key
// strategy handles snake_case without a CodingKeys enum per type.
let decoder = JSONDecoder()
decoder.keyDecodingStrategy = .convertFromSnakeCase
decoder.dateDecodingStrategy = .iso8601
let orders = try decoder.decode([Order].self, from: data)`,
  },
  {
    id: "sw-coding-keys",
    title: "Map a field whose name differs",
    level: 4,
    tags: ["types"],
    code: `// Listing every case is required, not only the ones that differ — the
// enum replaces the default mapping rather than adding to it.
struct Order: Codable {
  let id: String
  let createdAt: Date

  enum CodingKeys: String, CodingKey {
    case id = "order_id"
    case createdAt
  }
}`,
  },
  {
    id: "sw-throws",
    title: "Throw, and catch",
    level: 3,
    tags: ["errors"],
    code: `// try marks every call that can fail, so the places an error can come
// from are visible in the source rather than inferred.
do {
  let orders = try repository.fetchOrders()
  render(orders)
} catch {
  print("Failed: \\(error)")
}`,
  },
  {
    id: "sw-error-enum",
    title: "An error type of your own",
    level: 3,
    tags: ["errors"],
    code: `// An enum conforming to Error, so the catch site can switch over the
// cases exhaustively instead of matching on a message.
enum OrderError: Error {
  case notFound(id: String)
  case invalidQuantity(Int)
  case network(underlying: Error)
}`,
  },
  {
    id: "sw-try-variants",
    title: "try, try? and try!",
    level: 4,
    tags: ["errors"],
    code: `// try? turns the error into nil and discards why it failed; try! crashes
// on one. Both are occasionally right and usually a shortcut.
let cached = try? cache.load()
let orders = try repository.fetchOrders()`,
  },
  {
    id: "sw-defer",
    title: "Run something on the way out",
    level: 4,
    tags: ["errors"],
    code: `// defer runs when the scope exits, however it exits — return, throw or
// fall through — which is what makes the cleanup impossible to skip.
func process(path: URL) throws {
  let handle = try FileHandle(forReadingFrom: path)
  defer { try? handle.close() }
  try handle.readToEnd()
}`,
  },
  {
    id: "sw-map-filter",
    title: "The collection operations you reach for daily",
    level: 2,
    tags: ["collections"],
    code: `// Each returns a new collection, so nothing above the chain is changed
// by anything below it.
let ids =
  orders
  .filter { $0.total > 100 }
  .sorted { $0.total > $1.total }
  .map(\\.id)`,
  },
  {
    id: "sw-compact-map",
    title: "Map and drop the nils in one pass",
    level: 3,
    tags: ["collections"],
    code: `// compactMap is map followed by removing the nils, which is the shape
// almost every parse-a-list-of-strings problem takes.
let numbers = inputs.compactMap { Int($0) }`,
  },
  {
    id: "sw-reduce-grouping",
    title: "Group and total",
    level: 4,
    tags: ["collections"],
    code: `// Dictionary(grouping:by:) then mapValues: the Swift spelling of a
// GROUP BY, and it reads in the same order as the question.
let revenueByCountry = Dictionary(grouping: orders, by: \\.country)
  .mapValues { $0.reduce(0) { $0 + $1.total } }`,
  },
  {
    id: "sw-lazy",
    title: "A lazy chain over a large collection",
    level: 5,
    tags: ["collections"],
    code: `// Without lazy, the filter builds a whole array before first takes one
// element from it. With it, the chain stops at the first match.
let firstLarge = orders.lazy.filter { $0.total > 100 }.first`,
  },
  {
    id: "sw-async-await",
    title: "An asynchronous function",
    level: 4,
    tags: ["concurrency"],
    code: `// async marks the suspension points and await marks where they happen,
// so the control flow reads top to bottom despite not running that way.
func loadDashboard() async throws -> Dashboard {
  let orders = try await api.fetchOrders()
  let profile = try await api.fetchProfile()
  return Dashboard(orders: orders, profile: profile)
}`,
  },
  {
    id: "sw-async-let",
    title: "Run two calls at once",
    level: 5,
    tags: ["concurrency"],
    code: `// async let starts both immediately; the awaits collect them. The total
// wait is the slower of the two rather than the sum, unlike the version
// above.
func loadDashboard() async throws -> Dashboard {
  async let orders = api.fetchOrders()
  async let profile = api.fetchProfile()
  return Dashboard(orders: try await orders, profile: try await profile)
}`,
  },
  {
    id: "sw-task-group",
    title: "Fan out over a collection",
    level: 5,
    tags: ["concurrency"],
    code: `// A task group for work whose size is not known at compile time. The
// group cannot outlive the scope, so nothing is left running.
try await withThrowingTaskGroup(of: Order.self) { group in
  for id in ids {
    group.addTask { try await api.fetchOrder(id: id) }
  }
  return try await group.reduce(into: []) { $0.append($1) }
}`,
  },
  {
    id: "sw-actor",
    title: "An actor",
    level: 5,
    tags: ["concurrency"],
    code: `// An actor serialises access to its own state, so the data race is
// prevented by the type system rather than by a lock you must remember.
actor OrderCache {
  private var storage: [String: Order] = [:]

  func store(_ order: Order) {
    storage[order.id] = order
  }
}`,
  },
  {
    id: "sw-mainactor",
    title: "Get back to the main thread",
    level: 4,
    tags: ["concurrency"],
    code: `// @MainActor is a compile-time guarantee, not a dispatch call: the
// compiler refuses to call this from anywhere else without an await.
@MainActor
func render(_ orders: [Order]) {
  self.orders = orders
}`,
  },
  {
    id: "sw-swiftui-view",
    title: "A SwiftUI view",
    level: 3,
    tags: ["swiftui"],
    code: `// body is recomputed whenever the state it reads changes, so the view
// is a function of the state rather than something you mutate.
struct OrderList: View {
  let orders: [Order]

  var body: some View {
    List(orders, id: \\.id) { order in
      Text(order.id)
    }
  }
}`,
  },
  {
    id: "sw-swiftui-state",
    title: "State that drives the view",
    level: 4,
    tags: ["swiftui"],
    code: `// @State owns the value and @Binding borrows it, so a child can write
// to a parent's state without owning it or copying it.
struct Counter: View {
  @State private var count = 0

  var body: some View {
    Button("Tapped \\(count) times") { count += 1 }
  }
}`,
  },
  {
    id: "sw-swiftui-task",
    title: "Load data when a view appears",
    level: 4,
    tags: ["swiftui"],
    code: `// task runs when the view appears and is cancelled when it disappears,
// which is the part onAppear plus a Task does not give you.
.task {
  do {
    orders = try await repository.fetchOrders()
  } catch {
    self.error = error
  }
}`,
  },
];
