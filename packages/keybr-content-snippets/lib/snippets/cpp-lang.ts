import { type Snippet } from "../types.ts";

/**
 * Modern C++, and the C it grew out of.
 *
 * C++17 and C++20 rather than the C-with-classes most people were taught: RAII
 * and smart pointers instead of new and delete, `auto` and structured
 * bindings, ranges instead of iterator pairs. The recurring theme is that
 * almost every rule in the language exists to make ownership explicit.
 *
 * Checked by clang-format on the LLVM style — the tool's own default, and the
 * one a project that has not chosen otherwise ends up with.
 */
export const cppLang: readonly Snippet[] = [
  {
    id: "cpp-auto",
    title: "auto, and where it earns its place",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// Essential for an iterator type nobody wants to spell, and unhelpful
// where the type is the point. auto& avoids a copy in a range-for.
auto it = orders.find(id);
const auto &order = *it;`,
  },
  {
    id: "cpp-const",
    title: "const, and where it goes",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// Read right to left: a const pointer to a const int. Putting const on
// everything that does not change is the cheapest documentation there is.
const int max_retries = 3;
const int *const limit = &max_retries;`,
  },
  {
    id: "cpp-range-for",
    title: "A range-based for loop",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// const auto& reads without copying. Plain auto copies every element,
// which on a vector of strings is a silent allocation per iteration.
for (const auto &order : orders) {
  std::cout << order.id << '\\n';
}`,
  },
  {
    id: "cpp-structured-binding",
    title: "Structured bindings",
    level: 3,
    tags: ["basics"],
    scope: "statement",
    code: `// Names for the halves of a pair, so the loop body says what it means
// rather than reading first and second.
for (const auto &[country, total] : revenue_by_country) {
  std::cout << country << ": " << total << '\\n';
}`,
  },
  {
    id: "cpp-nullptr",
    title: "nullptr, not NULL and not 0",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// nullptr has its own type, so it cannot be picked up by an overload
// that takes an int — which is exactly what NULL does.
Order *found = nullptr;`,
  },
  {
    id: "cpp-raii",
    title: "RAII: the destructor does the cleanup",
    level: 4,
    tags: ["ownership"],
    code: `// Acquire in the constructor, release in the destructor. The file is
// closed however the scope ends, including by an exception — which is what
// makes a manual close call a bug waiting for a throw.
class FileHandle {
public:
  explicit FileHandle(const std::string &path)
      : file_(std::fopen(path.c_str(), "r")) {}
  ~FileHandle() {
    if (file_ != nullptr) {
      std::fclose(file_);
    }
  }

private:
  std::FILE *file_;
};`,
  },
  {
    id: "cpp-unique-ptr",
    title: "unique_ptr, for single ownership",
    level: 3,
    tags: ["ownership"],
    scope: "statement",
    code: `// make_unique rather than new: exception-safe, and it never leaves a
// raw pointer visible for anyone to delete twice.
auto repository = std::make_unique<SqlRepository>(connection_string);`,
  },
  {
    id: "cpp-shared-ptr",
    title: "shared_ptr, and its cost",
    level: 4,
    tags: ["ownership"],
    scope: "statement",
    code: `// A reference count updated atomically on every copy. Reach for unique
// first; shared is for genuinely shared ownership, not for convenience.
auto cache = std::make_shared<OrderCache>();
auto observer = std::weak_ptr<OrderCache>(cache);`,
  },
  {
    id: "cpp-move",
    title: "Move instead of copying",
    level: 4,
    tags: ["ownership"],
    scope: "statement",
    code: `// std::move casts to an rvalue reference; it moves nothing itself. What
// follows is that the source is left valid but unspecified, so do not read
// it again.
std::vector<Order> loaded = load_orders();
storage.assign(std::move(loaded));`,
  },
  {
    id: "cpp-rule-of-five",
    title: "The rule of five",
    level: 5,
    tags: ["ownership"],
    code: `// Declare one of these and you owe the compiler the rest. = default and
// = delete say which, and are far safer than writing them by hand.
class Buffer {
public:
  Buffer(const Buffer &) = delete;
  Buffer &operator=(const Buffer &) = delete;
  Buffer(Buffer &&) noexcept = default;
  Buffer &operator=(Buffer &&) noexcept = default;
  ~Buffer() = default;
};`,
  },
  {
    id: "cpp-struct",
    title: "A struct, and aggregate initialisation",
    level: 2,
    tags: ["types"],
    code: `// Braces rather than parentheses: brace initialisation refuses a
// narrowing conversion, which the parenthesised form silently allows.
struct Order {
  std::string id;
  int quantity{1};
  double total{0.0};
};

Order order{"o-1", 2, 51.25};`,
  },
  {
    id: "cpp-class-access",
    title: "A class, with its invariant protected",
    level: 3,
    tags: ["types"],
    code: `// explicit stops a single-argument constructor being used as an implicit
// conversion, which is almost never what was intended.
class Money {
public:
  explicit Money(long cents) : cents_(cents) {}
  [[nodiscard]] long cents() const noexcept { return cents_; }

private:
  long cents_;
};`,
  },
  {
    id: "cpp-enum-class",
    title: "enum class, not enum",
    level: 3,
    tags: ["types"],
    code: `// Scoped, so the names do not leak, and not implicitly convertible to
// int — which is what stops two unrelated enums being compared.
enum class Status : std::uint8_t { Draft, Published, Archived };`,
  },
  {
    id: "cpp-optional",
    title: "optional, for a value that may not be there",
    level: 3,
    tags: ["types"],
    code: `// Says in the signature what a null pointer or a magic -1 only says in
// the documentation.
std::optional<Order> find(const std::string &id) const {
  const auto it = orders_.find(id);
  if (it == orders_.end()) {
    return std::nullopt;
  }
  return it->second;
}`,
  },
  {
    id: "cpp-variant",
    title: "variant, for one of several types",
    level: 5,
    tags: ["types"],
    code: `// A type-safe union. visit dispatches on whichever alternative is held,
// and the compiler checks every one is handled.
using Shape = std::variant<Circle, Rectangle>;

double area(const Shape &shape) {
  return std::visit([](const auto &s) { return s.area(); }, shape);
}`,
  },
  {
    id: "cpp-string-view",
    title: "string_view, for a parameter you only read",
    level: 4,
    tags: ["types"],
    code: `// Takes a std::string and a literal without allocating either. It does
// not own the characters, so never store one that outlives its source.
std::size_t word_count(std::string_view text);`,
  },
  {
    id: "cpp-vector",
    title: "vector, reserved once",
    level: 3,
    tags: ["collections"],
    scope: "statement",
    code: `// reserve avoids the repeated reallocation push_back causes as the
// vector grows, when the final size is already known.
std::vector<std::string> ids;
ids.reserve(orders.size());
for (const auto &order : orders) {
  ids.push_back(order.id);
}`,
  },
  {
    id: "cpp-emplace",
    title: "emplace_back, to build in place",
    level: 4,
    tags: ["collections"],
    scope: "statement",
    code: `// Constructs the element inside the vector from its arguments, where
// push_back would construct a temporary and then move it.
orders.emplace_back("o-2", 1, 19.99);`,
  },
  {
    id: "cpp-map",
    title: "A map, looked up once",
    level: 3,
    tags: ["collections"],
    scope: "statement",
    code: `// operator[] inserts a default when the key is absent, which is a
// surprise in a const context and a silent bug in a lookup. find does not.
if (const auto it = counts.find(country); it != counts.end()) {
  std::cout << it->second << '\\n';
}`,
  },
  {
    id: "cpp-algorithm",
    title: "An algorithm instead of a loop",
    level: 3,
    tags: ["collections"],
    scope: "statement",
    code: `// Says what is being done rather than how. The name is the comment the
// hand-written loop would have needed.
const auto large =
    std::count_if(orders.begin(), orders.end(),
                  [](const Order &o) { return o.total > 100.0; });`,
  },
  {
    id: "cpp-ranges",
    title: "Ranges, in C++20",
    level: 5,
    tags: ["collections"],
    scope: "statement",
    code: `// No iterator pairs and no intermediate containers: the views are lazy
// and compose left to right.
auto ids =
    orders |
    std::views::filter([](const Order &o) { return o.total > 100.0; }) |
    std::views::transform(&Order::id);`,
  },
  {
    id: "cpp-lambda",
    title: "A lambda, and what it captures",
    level: 4,
    tags: ["basics"],
    scope: "statement",
    code: `// Capture by name rather than with [=] or [&]: the first copies more
// than you meant, and the second dangles the moment the lambda outlives
// the scope.
const auto over = [threshold](const Order &o) { return o.total > threshold; };`,
  },
  {
    id: "cpp-template",
    title: "A function template",
    level: 4,
    tags: ["templates"],
    code: `// Instantiated per type at compile time, so it costs nothing at run
// time compared with writing each one out.
template <typename T> const T &larger(const T &a, const T &b) {
  return a < b ? b : a;
}`,
  },
  {
    id: "cpp-concept",
    title: "A concept, to say what a template needs",
    level: 5,
    tags: ["templates"],
    code: `// The C++20 answer to a page of template error messages: the constraint
// is checked at the call site and reported there.
template <typename T>
concept Summable = requires(T a, T b) {
  { a + b } -> std::convertible_to<T>;
};`,
  },
  {
    id: "cpp-constexpr",
    title: "constexpr, computed at compile time",
    level: 4,
    tags: ["templates"],
    code: `// Evaluated during compilation where it can be, so the value is in the
// binary rather than computed on every start-up.
constexpr std::size_t kMaxRetries = 3;

constexpr std::size_t total_attempts(std::size_t retries) {
  return retries + 1;
}`,
  },
  {
    id: "cpp-exception",
    title: "Throw by value, catch by const reference",
    level: 4,
    tags: ["errors"],
    scope: "statement",
    code: `// Catching by value slices a derived exception down to its base and
// loses exactly the information you wanted.
try {
  save(order);
} catch (const std::runtime_error &error) {
  std::cerr << error.what() << '\\n';
}`,
  },
  {
    id: "cpp-noexcept",
    title: "noexcept, and what it promises",
    level: 5,
    tags: ["errors"],
    code: `// A move constructor marked noexcept is what lets vector move rather
// than copy when it grows. Breaking the promise calls std::terminate.
Buffer(Buffer &&other) noexcept;`,
  },
  {
    id: "cpp-header-guard",
    title: "A header, guarded",
    level: 3,
    tags: ["structure"],
    code: `// #pragma once is shorter and supported everywhere that matters; the
// include guard is the portable form and the one still seen in old code.
#pragma once

#include <string>
#include <vector>`,
  },
  {
    id: "cpp-namespace",
    title: "A namespace, and the anonymous one",
    level: 4,
    tags: ["structure"],
    code: `// An anonymous namespace gives internal linkage, so a helper in a .cpp
// file cannot collide with one of the same name elsewhere.
namespace keylearn {
namespace {
constexpr int kDefaultPort = 3000;
}
} // namespace keylearn`,
  },
  {
    id: "cpp-c-string",
    title: "C strings, and the size that is always wrong",
    level: 4,
    tags: ["c"],
    scope: "statement",
    code: `/* strncpy does not always terminate, so the last byte is set by hand.
 * This is the reason C++ has std::string. */
char buffer[64];
strncpy(buffer, source, sizeof(buffer) - 1);
buffer[sizeof(buffer) - 1] = '\\0';`,
  },
  {
    id: "cpp-c-malloc",
    title: "Check every allocation",
    level: 3,
    tags: ["c"],
    scope: "statement",
    code: `/* malloc returns NULL when it fails, and nothing forces you to look.
 * Every unchecked allocation is a crash waiting for a low-memory day. */
int *values = malloc(count * sizeof(*values));
if (values == NULL) {
  return -1;
}`,
  },
  {
    id: "cpp-c-struct",
    title: "A C struct and its functions",
    level: 3,
    tags: ["c"],
    code: `/* C has no methods, so the type is the first parameter by convention.
 * The typedef saves writing struct at every use. */
typedef struct {
  char id[16];
  int quantity;
  double total;
} Order;

double order_subtotal(const Order *order);`,
  },
];
