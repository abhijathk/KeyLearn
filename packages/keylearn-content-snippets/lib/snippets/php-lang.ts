import { type Snippet } from "../types.ts";

/**
 * PHP, on PSR-12.
 *
 * Modern PHP — typed properties, enums, readonly, constructor promotion, named
 * arguments — rather than the PHP most people remember. The language changed
 * more between 7.4 and 8.3 than in the decade before, and almost none of it
 * has reached the tutorials.
 *
 * PSR-12 is what Composer packages follow and what every framework's own
 * standard is derived from, so it is the one worth building the habit around.
 */
export const phpLang: readonly Snippet[] = [
  {
    id: "php-strict-types",
    title: "The line every file should open with",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// Without it, passing "5" where an int is declared silently coerces. With
// it, that is a TypeError — and that is the whole point of declaring the
// type. It must be the first statement in the file, right after <?php.
declare(strict_types=1);`,
  },
  {
    id: "php-typed-function",
    title: "A function, with its types declared",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// Both directions: what goes in and what comes out. The return type is
// the one people leave off, and it is the one that catches the most.
function subtotal(int $quantity, float $unitPrice): float
{
    return $quantity * $unitPrice;
}`,
  },
  {
    id: "php-nullable-union",
    title: "Nullable and union types",
    level: 3,
    tags: ["basics"],
    scope: "statement",
    code: `// The question mark is shorthand for a union with null. A union spells
// out every type the value may take, and the engine enforces it.
function find(string $id): ?Order
{
    return $this->orders[$id] ?? null;
}`,
  },
  {
    id: "php-null-operators",
    title: "The null operators",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// ?? falls back on null without a notice for a missing key; ?-> stops the
// chain rather than throwing on null.
$city = $order?->customer?->address?->city ?? "unknown";`,
  },
  {
    id: "php-match",
    title: "match, not switch",
    level: 3,
    tags: ["basics"],
    scope: "statement",
    code: `// An expression, strictly compared, with no fall-through, and it throws
// when nothing matches rather than quietly doing nothing.
$band = match (true) {
    $total > 500 => "premium",
    $total > 100 => "large",
    default => "small",
};`,
  },
  {
    id: "php-class-promotion",
    title: "Constructor property promotion",
    level: 3,
    tags: ["types"],
    scope: "statement",
    code: `// Declares the property, types it and assigns it. This replaces the three
// lines per dependency that every PHP class used to open with.
final class OrderService
{
    public function __construct(
        private readonly OrderRepository $repository,
        private readonly LoggerInterface $logger,
    ) {}
}`,
  },
  {
    id: "php-readonly",
    title: "readonly, for a value object",
    level: 3,
    tags: ["types"],
    scope: "statement",
    code: `// Assignable once, from inside the class. An immutable object without a
// private property and a getter for each field.
final class Money
{
    public function __construct(
        public readonly int $cents,
        public readonly string $currency = "AUD",
    ) {}
}`,
  },
  {
    id: "php-enum",
    title: "A backed enum",
    level: 3,
    tags: ["types"],
    scope: "statement",
    code: `// A real type, not a set of constants: it cannot hold a value outside the
// cases, and it can be type-hinted like anything else.
enum OrderStatus: string
{
    case Draft = "draft";
    case Paid = "paid";
    case Cancelled = "cancelled";
}`,
  },
  {
    id: "php-enum-method",
    title: "An enum with behaviour",
    level: 4,
    tags: ["types"],
    scope: "statement",
    code: `// Methods on an enum keep the logic beside the values instead of in a
// match somewhere else that nobody updates.
enum OrderStatus: string
{
    case Draft = "draft";
    case Paid = "paid";

    public function isFinal(): bool
    {
        return $this === self::Paid;
    }
}`,
  },
  {
    id: "php-interface",
    title: "An interface",
    level: 2,
    tags: ["types"],
    scope: "statement",
    code: `// Type-hinting the interface rather than the class is what makes a second
// implementation possible without touching the callers.
interface OrderRepository
{
    public function find(string $id): ?Order;

    public function save(Order $order): void;
}`,
  },
  {
    id: "php-named-arguments",
    title: "Named arguments",
    level: 3,
    tags: ["basics"],
    scope: "statement",
    code: `// Skip the optional ones you do not care about, and read at the call site
// as documentation. The order no longer matters.
$client = new HttpClient(baseUrl: "https://api.example.com", timeout: 30);`,
  },
  {
    id: "php-first-class-callable",
    title: "A first-class callable",
    level: 4,
    tags: ["functions"],
    scope: "statement",
    code: `// The (...) syntax makes a Closure from a method, replacing the string
// and array forms that no editor could ever follow.
$ids = array_map($order->id(...), $orders);`,
  },
  {
    id: "php-arrow-fn",
    title: "An arrow function",
    level: 3,
    tags: ["functions"],
    scope: "statement",
    code: `// Captures the outer scope automatically, so there is no use clause. One
// expression only, which is the trade.
$large = array_filter($orders, fn(Order $order) => $order->total > $threshold);`,
  },
  {
    id: "php-array-functions",
    title: "The array functions worth knowing",
    level: 2,
    tags: ["collections"],
    scope: "statement",
    code: `// Note the argument order differs between map and filter, which is a
// genuine wart and the reason to double-check every time.
$totals = array_map(fn(Order $o) => $o->total, $orders);
$paid = array_filter($orders, fn(Order $o) => $o->isPaid);
$revenue = array_sum($totals);`,
  },
  {
    id: "php-array-column",
    title: "Index a list by one of its fields",
    level: 4,
    tags: ["collections"],
    scope: "statement",
    code: `// A lookup table in one call, where the hand-written foreach takes four
// lines and one chance to get the key wrong.
$byId = array_column($orders, null, "id");`,
  },
  {
    id: "php-spread-unpack",
    title: "Spread, including string keys",
    level: 4,
    tags: ["collections"],
    scope: "statement",
    code: `// Later keys win, so this is the idiomatic way to apply overrides on top
// of a set of defaults.
$config = [...$defaults, ...$overrides];`,
  },
  {
    id: "php-list-destructure",
    title: "Destructure an array",
    level: 3,
    tags: ["collections"],
    scope: "statement",
    code: `// The bracket form works with string keys too, which makes it useful for
// pulling named fields out of a decoded payload.
["id" => $id, "total" => $total] = $payload;`,
  },
  {
    id: "php-foreach-reference",
    title: "The foreach-by-reference trap",
    level: 5,
    tags: ["collections"],
    scope: "statement",
    code: `// After a loop by reference, $order still points at the last element, so
// a second foreach reusing the name corrupts it. Always unset it.
foreach ($orders as &$order) {
    $order->total = round($order->total, 2);
}
unset($order);`,
  },
  {
    id: "php-exception",
    title: "Catch what you can handle",
    level: 3,
    tags: ["errors"],
    scope: "statement",
    code: `// A union catch, and the previous exception passed on — dropping it is
// what turns a useful stack trace into a dead end.
try {
    $this->repository->save($order);
} catch (PDOException | RuntimeException $e) {
    throw new StorageException("saving order {$order->id}", previous: $e);
}`,
  },
  {
    id: "php-custom-exception",
    title: "An exception type of your own",
    level: 3,
    tags: ["errors"],
    scope: "statement",
    code: `// Extending the right base matters: a LogicException is a bug in the
// code, a RuntimeException is something that went wrong while it ran.
final class OrderNotFoundException extends RuntimeException
{
    public function __construct(public readonly string $id)
    {
        parent::__construct("Order {$id} was not found");
    }
}`,
  },
  {
    id: "php-finally",
    title: "finally runs whatever happens",
    level: 3,
    tags: ["errors"],
    scope: "statement",
    code: `// Including on a return from inside the try, which is what makes it the
// right place for a rollback or a release.
try {
    $pdo->beginTransaction();
    $this->insert($order);
    $pdo->commit();
} catch (PDOException $e) {
    $pdo->rollBack();
    throw $e;
}`,
  },
  {
    id: "php-pdo-prepared",
    title: "A prepared statement, always",
    level: 3,
    tags: ["database"],
    scope: "statement",
    code: `// The only correct way to put a value into SQL. String interpolation
// here is the injection vulnerability, every single time.
$statement = $pdo->prepare("SELECT * FROM orders WHERE country = :country");
$statement->execute(["country" => $country]);
$rows = $statement->fetchAll(PDO::FETCH_ASSOC);`,
  },
  {
    id: "php-pdo-connect",
    title: "Connect with the settings that matter",
    level: 4,
    tags: ["database"],
    scope: "statement",
    code: `// ERRMODE_EXCEPTION turns a silent false return into an exception, and
// EMULATE_PREPARES off means the driver really does prepare.
$pdo = new PDO($dsn, $user, $password, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);`,
  },
  {
    id: "php-json",
    title: "Decode JSON, and notice when it fails",
    level: 3,
    tags: ["basics"],
    scope: "statement",
    code: `// Without THROW_ON_ERROR, a malformed payload returns null and looks
// exactly like a valid JSON null.
$payload = json_decode($body, true, flags: JSON_THROW_ON_ERROR);`,
  },
  {
    id: "php-htmlspecialchars",
    title: "Escape on output",
    level: 3,
    tags: ["errors"],
    scope: "statement",
    code: `// Escaping when the value is printed, not when it is stored: the same
// string needs different escaping in HTML, in an attribute and in a URL.
echo htmlspecialchars($order->note, ENT_QUOTES | ENT_SUBSTITUTE, "UTF-8");`,
  },
  {
    id: "php-password",
    title: "Hash a password properly",
    level: 4,
    tags: ["errors"],
    scope: "statement",
    code: `// PASSWORD_DEFAULT follows the language's current recommendation, so the
// algorithm improves without this code changing. Never md5, never sha1.
$hash = password_hash($plain, PASSWORD_DEFAULT);

if (password_verify($plain, $hash)) {
    // …
}`,
  },
  {
    id: "php-generator",
    title: "A generator, for a large result set",
    level: 5,
    tags: ["functions"],
    scope: "statement",
    code: `// Yields one row at a time, so a million-row export uses the memory of
// one row rather than of a million.
function eachOrder(PDOStatement $statement): Generator
{
    while (($row = $statement->fetch()) !== false) {
        yield Order::fromRow($row);
    }
}`,
  },
  {
    id: "php-attribute",
    title: "An attribute",
    level: 5,
    tags: ["types"],
    scope: "member",
    code: `// Structured metadata the engine can read by reflection, replacing the
// doc-block annotations frameworks used to parse out of comments.
#[Route("/orders/{id}", methods: ["GET"])]
public function show(string $id): Response
{
    return $this->json($this->repository->find($id));
}`,
  },
  {
    id: "php-static-factory",
    title: "A named constructor",
    level: 3,
    tags: ["types"],
    scope: "member",
    code: `// PHP has one constructor per class, so a static method is how a second
// way of building the object gets a name.
public static function fromRow(array $row): self
{
    return new self(id: $row["id"], quantity: (int) $row["quantity"]);
}`,
  },
  {
    id: "php-test",
    title: "A PHPUnit test",
    level: 3,
    tags: ["testing"],
    scope: "member",
    code: `// Arrange, act, assert, separated by blank lines. The method name is the
// sentence the failure report will print.
public function testFindReturnsNullWhenTheOrderIsMissing(): void
{
    $repository = new InMemoryOrderRepository();

    $order = $repository->find("missing");

    $this->assertNull($order);
}`,
  },
  {
    id: "php-data-provider",
    title: "One test over several inputs",
    level: 4,
    tags: ["testing"],
    scope: "member",
    code: `// Each row becomes its own reported case, so a failure names the input
// rather than pointing at a loop.
public static function planPrices(): array
{
    return [
        "basic" => ["basic", 7.99],
        "premium" => ["premium", 19.99],
    ];
}`,
  },
];
