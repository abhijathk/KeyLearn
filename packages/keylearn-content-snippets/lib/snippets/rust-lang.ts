import { type Snippet } from "../types.ts";

/**
 * Rust, checked by rustfmt.
 *
 * Ownership first, because nothing else in the language makes sense until it
 * does, and because it is the part that cannot be picked up by analogy with
 * another language. After that: the two enums the standard library is built
 * on, pattern matching, traits, and the error handling that follows from them.
 *
 * rustfmt has no meaningful configuration and everybody uses it, which makes
 * it the strictest and least arguable gate in this package.
 */
export const rustLang: readonly Snippet[] = [
  {
    id: "rs-let",
    title: "Bindings are immutable unless you say otherwise",
    level: 1,
    tags: ["basics"],
    scope: "statement",
    code: `// The opposite default from most languages, and the reason so much Rust
// code turns out not to need mut at all.
let name = "Ada";
let mut attempts = 0;`,
  },
  {
    id: "rs-shadowing",
    title: "Shadowing, which is not mutation",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// A second let with the same name makes a new binding, so the type may
// change. Handy for parse-then-use without inventing input_str.
let input = "42";
let input: u32 = input.parse().expect("not a number");`,
  },
  {
    id: "rs-fn",
    title: "A function",
    level: 1,
    tags: ["basics"],
    code: `// The last expression is the return value, with no semicolon. Adding one
// turns it into a statement and the function returns ().
fn double(value: i32) -> i32 {
    value * 2
}`,
  },
  {
    id: "rs-if-expression",
    title: "if is an expression",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// Both branches must have the same type, which is what lets this stand
// in for the ternary Rust does not have.
let band = if total > 100 { "large" } else { "small" };`,
  },
  {
    id: "rs-loops",
    title: "The three loops, and the one that returns a value",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// loop is the only one that can break with a value, which makes it the
// right choice for retry-until-success.
let result = loop {
    match try_connect() {
        Ok(connection) => break connection,
        Err(_) => continue,
    }
};`,
  },
  {
    id: "rs-ownership-move",
    title: "A move, and why the original is gone",
    level: 3,
    tags: ["ownership"],
    scope: "statement",
    code: `// A String owns heap memory, so assigning it transfers ownership rather
// than copying. Using first after this line is a compile error, which is
// the whole point: there is never a second owner to free it twice.
let first = String::from("Ada");
let second = first;`,
  },
  {
    id: "rs-clone-copy",
    title: "Clone when you mean to copy",
    level: 3,
    tags: ["ownership"],
    scope: "statement",
    code: `// Explicit, because it may be expensive. Small types like i32 implement
// Copy instead and are duplicated silently, which is cheap and fine.
let first = String::from("Ada");
let second = first.clone();`,
  },
  {
    id: "rs-borrow",
    title: "Borrow instead of moving",
    level: 3,
    tags: ["ownership"],
    code: `// A shared reference lets the function read without taking ownership,
// so the caller still has the value afterwards.
fn length(text: &String) -> usize {
    text.len()
}`,
  },
  {
    id: "rs-mutable-borrow",
    title: "One mutable borrow at a time",
    level: 4,
    tags: ["ownership"],
    code: `// Any number of shared borrows, or exactly one mutable borrow, never
// both. That single rule is what makes data races impossible to compile.
fn push_twice(items: &mut Vec<i32>) {
    items.push(1);
    items.push(2);
}`,
  },
  {
    id: "rs-slice",
    title: "Take a slice rather than the whole thing",
    level: 3,
    tags: ["ownership"],
    code: `// &str and &[T] are borrowed views. A function taking &str accepts both
// a String and a literal, which &String does not.
fn first_word(text: &str) -> &str {
    text.split_whitespace().next().unwrap_or("")
}`,
  },
  {
    id: "rs-lifetime",
    title: "A lifetime, when the compiler cannot infer it",
    level: 5,
    tags: ["ownership"],
    code: `// The annotation says the result lives as long as the shorter of the two
// inputs. It describes a relationship; it does not change how long anything
// actually lives.
fn longest<'a>(left: &'a str, right: &'a str) -> &'a str {
    if left.len() >= right.len() {
        left
    } else {
        right
    }
}`,
  },
  {
    id: "rs-struct",
    title: "A struct",
    level: 2,
    tags: ["types"],
    code: `// Fields are private outside the module unless marked pub, so the
// default is an encapsulated type rather than an open one.
pub struct Order {
    pub id: String,
    pub quantity: u32,
    total: f64,
}`,
  },
  {
    id: "rs-impl",
    title: "Methods, in an impl block",
    level: 2,
    tags: ["types"],
    code: `// &self borrows, self consumes, &mut self borrows mutably. Choosing the
// wrong one is the most common early mistake.
impl Order {
    pub fn new(id: String) -> Self {
        Self {
            id,
            quantity: 1,
            total: 0.0,
        }
    }

    pub fn total(&self) -> f64 {
        self.total
    }
}`,
  },
  {
    id: "rs-derive",
    title: "Derive the obvious implementations",
    level: 2,
    tags: ["types"],
    code: `// Four traits for one line. Debug is the one to add reflexively — it is
// what lets a value be printed when a test fails.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Sku(String);`,
  },
  {
    id: "rs-enum",
    title: "An enum that carries data",
    level: 3,
    tags: ["types"],
    code: `// Each variant has its own shape, so an impossible combination cannot be
// constructed. This is the type Result and Option are both instances of.
pub enum Shape {
    Circle { radius: f64 },
    Rectangle { width: f64, height: f64 },
    Point,
}`,
  },
  {
    id: "rs-match",
    title: "match, and why it must be exhaustive",
    level: 3,
    tags: ["matching"],
    code: `// Every variant handled, or it does not compile. Adding a fourth shape
// above turns this into an error rather than a silent fall-through.
fn area(shape: &Shape) -> f64 {
    match shape {
        Shape::Circle { radius } => std::f64::consts::PI * radius * radius,
        Shape::Rectangle { width, height } => width * height,
        Shape::Point => 0.0,
    }
}`,
  },
  {
    id: "rs-match-guard",
    title: "A match arm with a condition",
    level: 4,
    tags: ["matching"],
    scope: "statement",
    code: `// The guard runs after the pattern matches. Note that a guard does not
// count towards exhaustiveness, so a catch-all is still required.
let label = match total {
    t if t < 0.0 => "refund",
    0.0 => "free",
    t if t > 500.0 => "premium",
    _ => "standard",
};`,
  },
  {
    id: "rs-if-let",
    title: "if let, for the one case you care about",
    level: 3,
    tags: ["matching"],
    scope: "statement",
    code: `// A match with a single interesting arm, without the ceremony. let else
// is its counterpart for the early return.
if let Some(order) = orders.first() {
    println!("{}", order.id);
}`,
  },
  {
    id: "rs-let-else",
    title: "let else, for the early return",
    level: 4,
    tags: ["matching"],
    scope: "statement",
    code: `// The binding stays in scope afterwards, and the else block must
// diverge — return, break, or panic. Cleaner than a match that rebinds.
let Some(order) = orders.first() else {
    return Err(Error::Empty);
};`,
  },
  {
    id: "rs-option",
    title: "Option instead of null",
    level: 2,
    tags: ["errors"],
    code: `// There is no null in Rust. Absence is a value of the type, so the
// compiler makes you deal with it before you can read what is inside.
fn find(orders: &[Order], id: &str) -> Option<&Order> {
    orders.iter().find(|order| order.id == id)
}`,
  },
  {
    id: "rs-option-combinators",
    title: "Work with an Option without unwrapping it",
    level: 3,
    tags: ["errors"],
    scope: "statement",
    code: `// map transforms what is inside and leaves None alone; unwrap_or supplies
// the fallback. Between them they replace most of the matches you would
// otherwise write.
let name = order
    .map(|o| o.id.clone())
    .unwrap_or_else(|| "unknown".into());`,
  },
  {
    id: "rs-result",
    title: "Result, for what can fail",
    level: 3,
    tags: ["errors"],
    code: `// Failure is a return value rather than a hidden control path, so a
// caller cannot ignore it without saying so.
fn parse_quantity(input: &str) -> Result<u32, std::num::ParseIntError> {
    input.trim().parse()
}`,
  },
  {
    id: "rs-question-mark",
    title: "The question mark operator",
    level: 4,
    tags: ["errors"],
    code: `// Returns early on Err and unwraps on Ok. It converts the error type
// through From, which is what makes several error types compose.
fn load(path: &str) -> Result<Order, Error> {
    let text = std::fs::read_to_string(path)?;
    let order = serde_json::from_str(&text)?;
    Ok(order)
}`,
  },
  {
    id: "rs-unwrap-expect",
    title: "unwrap and expect, and where they belong",
    level: 3,
    tags: ["errors"],
    scope: "statement",
    code: `// Both panic. expect at least says why, which turns an unhelpful crash
// into a sentence. Neither belongs in a library.
let config = load_config().expect("config.toml is missing or invalid");`,
  },
  {
    id: "rs-custom-error",
    title: "An error type of your own",
    level: 5,
    tags: ["errors"],
    code: `// Implementing From is what lets the question mark above convert into
// this type automatically.
#[derive(Debug)]
pub enum Error {
    NotFound(String),
    Io(std::io::Error),
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}`,
  },
  {
    id: "rs-trait",
    title: "A trait",
    level: 3,
    tags: ["traits"],
    code: `// An interface, and the unit most of the standard library is built out
// of. A default body makes a method optional to implement.
pub trait Repository {
    fn find(&self, id: &str) -> Option<Order>;

    fn exists(&self, id: &str) -> bool {
        self.find(id).is_some()
    }
}`,
  },
  {
    id: "rs-impl-trait-for",
    title: "Implement a trait for a type",
    level: 3,
    tags: ["traits"],
    code: `// Display is what makes a value printable with {}. Debug, derived above,
// is for {:?} and for the developer; Display is for the user.
impl std::fmt::Display for Sku {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "SKU-{}", self.0)
    }
}`,
  },
  {
    id: "rs-generic-bound",
    title: "A generic with a trait bound",
    level: 4,
    tags: ["traits"],
    code: `// The bound is what makes the body legal. Monomorphised at compile time,
// so this costs nothing at run time compared with writing it out.
fn largest<T: PartialOrd + Copy>(items: &[T]) -> Option<T> {
    items
        .iter()
        .copied()
        .reduce(|a, b| if a > b { a } else { b })
}`,
  },
  {
    id: "rs-where-clause",
    title: "A where clause, when the bounds get long",
    level: 4,
    tags: ["traits"],
    code: `// The same constraints moved out of the signature, so the parameters
// stay readable.
fn print_all<T>(items: &[T])
where
    T: std::fmt::Display + Clone,
{
    for item in items {
        println!("{item}");
    }
}`,
  },
  {
    id: "rs-dyn-trait",
    title: "Static dispatch, and dynamic",
    level: 5,
    tags: ["traits"],
    code: `// impl Trait picks the type at compile time; Box<dyn Trait> defers it to
// run time and costs a pointer indirection. Prefer the first.
fn make_repository(in_memory: bool) -> Box<dyn Repository> {
    if in_memory {
        Box::new(InMemoryRepository::new())
    } else {
        Box::new(SqlRepository::new())
    }
}`,
  },
  {
    id: "rs-iterator-chain",
    title: "An iterator chain",
    level: 3,
    tags: ["iterators"],
    scope: "statement",
    code: `// Lazy: nothing happens until collect or another consumer asks for a
// value, so the intermediate collections are never built.
let ids: Vec<String> = orders
    .iter()
    .filter(|order| order.quantity > 1)
    .map(|order| order.id.clone())
    .collect();`,
  },
  {
    id: "rs-iterator-fold",
    title: "Sum, fold and the consumers",
    level: 3,
    tags: ["iterators"],
    scope: "statement",
    code: `// The turbofish tells sum what to add up, because the iterator alone
// does not say. fold is the general case when there is no sum for it.
let total: f64 = orders.iter().map(|order| order.total).sum();`,
  },
  {
    id: "rs-iterator-collect-result",
    title: "Collect into a Result",
    level: 5,
    tags: ["iterators"],
    scope: "statement",
    code: `// One of the language's neatest tricks: a collection of Results becomes
// a Result of a collection, short-circuiting on the first error.
let quantities: Result<Vec<u32>, _> = inputs.iter().map(|input| input.parse::<u32>()).collect();`,
  },
  {
    id: "rs-iterator-enumerate-zip",
    title: "enumerate and zip",
    level: 3,
    tags: ["iterators"],
    scope: "statement",
    code: `// Indexing by hand needs a bounds check every time; these do not, and
// they say what they mean.
for (position, order) in orders.iter().enumerate() {
    println!("{}. {}", position + 1, order.id);
}`,
  },
  {
    id: "rs-hashmap",
    title: "A HashMap, and the entry API",
    level: 4,
    tags: ["collections"],
    scope: "statement",
    code: `// entry looks the key up once whether or not it is present, which a
// contains_key followed by insert does twice.
let mut counts: HashMap<&str, u32> = HashMap::new();
for order in &orders {
    *counts.entry(&order.country).or_insert(0) += 1;
}`,
  },
  {
    id: "rs-vec",
    title: "A Vec, allocated once",
    level: 3,
    tags: ["collections"],
    scope: "statement",
    code: `// with_capacity avoids the repeated reallocation that push causes as a
// vector grows, when the final size is already known.
let mut ids = Vec::with_capacity(orders.len());
for order in &orders {
    ids.push(order.id.clone());
}`,
  },
  {
    id: "rs-closure",
    title: "A closure, and what it captures",
    level: 4,
    tags: ["basics"],
    scope: "statement",
    code: `// Captured by reference where it can be. move forces ownership, which is
// what a thread or an async task needs.
let threshold = 100.0;
let large = orders.iter().filter(|order| order.total > threshold);`,
  },
  {
    id: "rs-test",
    title: "A unit test, in the same file",
    level: 3,
    tags: ["testing"],
    code: `// Tests live beside the code and are compiled out of the release build.
// The cfg attribute is what makes that true.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn doubles_a_number() {
        assert_eq!(double(21), 42);
    }
}`,
  },
  {
    id: "rs-module",
    title: "Modules and visibility",
    level: 3,
    tags: ["basics"],
    code: `// Private by default, all the way down. pub(crate) is the useful middle
// ground: visible inside this crate and not part of its public API.
mod repository {
    pub(crate) fn connect() -> Connection {
        Connection::open()
    }
}`,
  },
];
