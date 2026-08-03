import { type Snippet } from "../types.ts";

/**
 * C#, as it is written on modern .NET.
 *
 * Records, pattern matching, nullable reference types and async all the way
 * down — the language has moved a long way from the Java-shaped C# of 2010,
 * and a corpus that taught that would be teaching a dialect nobody starts new
 * projects in.
 */
export const csharpLang: readonly Snippet[] = [
  {
    id: "cs-var",
    title: "var, and where it helps",
    level: 1,
    tags: ["basics"],
    code: `// Fine when the right-hand side names the type; unhelpful when it does
// not. The rule most teams settle on is: var when the type is obvious.
var orders = new List<Order>();
int quantity = Parse(input);`,
  },
  {
    id: "cs-method",
    title: "A method, with an expression body",
    level: 2,
    tags: ["basics"],
    code: `// The arrow form for anything that is a single expression. It reads as a
// definition rather than as a procedure with one step.
public decimal Subtotal(Order order) => order.Quantity * order.UnitPrice;`,
  },
  {
    id: "cs-string-interpolation",
    title: "String interpolation",
    level: 1,
    tags: ["basics"],
    code: `// The format specifier after the colon belongs to the value, so currency
// and dates come out right without a separate ToString call.
Console.WriteLine($"{order.Id}: {order.Total:C} on {order.CreatedAt:d}");`,
  },
  {
    id: "cs-nullable-reference",
    title: "Nullable reference types",
    level: 3,
    tags: ["nullability"],
    code: `// With the feature on, string cannot be null and string? can. The
// compiler warns where the two are confused, which is most of the value.
public string Name { get; set; } = string.Empty;
public string? MiddleName { get; set; }`,
  },
  {
    id: "cs-null-operators",
    title: "The null operators",
    level: 2,
    tags: ["nullability"],
    code: `// ?. stops the chain and yields null; ?? supplies the fallback; ??= only
// assigns when the target is null.
var city = order.Customer?.Address?.City ?? "unknown";
_cache ??= new Dictionary<string, Order>();`,
  },
  {
    id: "cs-null-guard",
    title: "Guard a parameter in one line",
    level: 3,
    tags: ["nullability"],
    code: `// ThrowIfNull reports the parameter name for you, which is what the
// hand-written version usually gets wrong after a rename.
public OrderService(IOrderRepository repository)
{
    ArgumentNullException.ThrowIfNull(repository);
    _repository = repository;
}`,
  },
  {
    id: "cs-record",
    title: "A record",
    level: 3,
    tags: ["types"],
    code: `// Value equality, a readable ToString and a with expression, from one
// line. For anything that is data rather than behaviour, prefer this.
public record Order(string Id, int Quantity, decimal Total);`,
  },
  {
    id: "cs-with-expression",
    title: "Copy a record with one change",
    level: 3,
    tags: ["types"],
    code: `// A shallow copy with the named properties replaced. The original is
// untouched, which is what makes records safe to pass around.
var discounted = order with { Total = order.Total * 0.9m };`,
  },
  {
    id: "cs-class-properties",
    title: "A class with auto-properties",
    level: 2,
    tags: ["types"],
    code: `// init makes the property settable only in an object initialiser, so an
// instance is immutable after construction without a constructor per field.
public class Customer
{
    public required string Id { get; init; }
    public string? Email { get; set; }
}`,
  },
  {
    id: "cs-object-initialiser",
    title: "An object initialiser",
    level: 2,
    tags: ["types"],
    code: `// Named at the point of construction. With required above, leaving Id
// out is a compile error rather than a null at run time.
var customer = new Customer { Id = "c-1", Email = "ada@example.com" };`,
  },
  {
    id: "cs-enum",
    title: "An enum, and a flags enum",
    level: 3,
    tags: ["types"],
    code: `// The Flags attribute changes how it prints and signals that the values
// are meant to be combined — which is why they must be powers of two.
[Flags]
public enum Permissions
{
    None = 0,
    Read = 1,
    Write = 2,
    Delete = 4
}`,
  },
  {
    id: "cs-interface",
    title: "An interface",
    level: 2,
    tags: ["types"],
    code: `// Async methods return Task and are named with the suffix, which is a
// convention strong enough that breaking it reads as a mistake.
public interface IOrderRepository
{
    Task<Order?> FindAsync(string id, CancellationToken cancellationToken);
    Task SaveAsync(Order order, CancellationToken cancellationToken);
}`,
  },
  {
    id: "cs-pattern-switch",
    title: "A switch expression",
    level: 4,
    tags: ["patterns"],
    code: `// An expression rather than a statement, so it returns a value and the
// compiler warns when a case is missing.
var band = total switch
{
    < 0m => "refund",
    0m => "free",
    < 100m => "small",
    _ => "large"
};`,
  },
  {
    id: "cs-pattern-type",
    title: "Match on the type, and bind at the same time",
    level: 4,
    tags: ["patterns"],
    code: `// The pattern declares the variable, so there is no cast and no second
// type check. Reads far better than the is-then-cast it replaces.
var description = shape switch
{
    Circle c => $"circle of radius {c.Radius}",
    Rectangle r => $"{r.Width} by {r.Height}",
    null => "nothing",
    _ => "unknown shape"
};`,
  },
  {
    id: "cs-pattern-property",
    title: "Match on the properties",
    level: 5,
    tags: ["patterns"],
    code: `// A property pattern reaches inside the object, so a condition about
// three fields stays one readable expression.
if (order is { Quantity: > 1, Status: OrderStatus.Paid, Customer.Country: "AU" })
{
    ApplyBulkDiscount(order);
}`,
  },
  {
    id: "cs-pattern-list",
    title: "Match on the shape of a list",
    level: 5,
    tags: ["patterns"],
    code: `// A list pattern with a slice. The discard in the middle matches any
// number of elements, so this is "first, last, and whatever between".
if (segments is [var first, .., var last])
{
    Console.WriteLine($"{first} … {last}");
}`,
  },
  {
    id: "cs-linq-query",
    title: "LINQ, in method syntax",
    level: 3,
    tags: ["linq"],
    code: `// Deferred: nothing runs until the result is enumerated, which is why
// ToList at the end matters when the source is a database.
var ids = orders
    .Where(order => order.Total > 100m)
    .OrderByDescending(order => order.Total)
    .Select(order => order.Id)
    .ToList();`,
  },
  {
    id: "cs-linq-group",
    title: "Group and total",
    level: 4,
    tags: ["linq"],
    code: `// GroupBy then a projection over each group. The equivalent of a SQL
// GROUP BY, and it reads in the same order as the question.
var revenue = orders
    .GroupBy(order => order.Country)
    .Select(group => new { Country = group.Key, Total = group.Sum(o => o.Total) })
    .ToList();`,
  },
  {
    id: "cs-linq-single",
    title: "First, Single, and the OrDefault pair",
    level: 3,
    tags: ["linq"],
    code: `// Single throws when there is more than one, which is the right choice
// when a duplicate would mean the data is wrong. First quietly takes one.
var order = orders.SingleOrDefault(o => o.Id == id);`,
  },
  {
    id: "cs-linq-any-all",
    title: "Any and All instead of counting",
    level: 2,
    tags: ["linq"],
    code: `// Any stops at the first match; Count() walks the whole sequence. On a
// database query the difference is an EXISTS rather than a COUNT.
if (orders.Any(order => order.Status == OrderStatus.Unpaid))
{
    NotifyAccounts();
}`,
  },
  {
    id: "cs-async-await",
    title: "An async method",
    level: 3,
    tags: ["async"],
    code: `// Async all the way up: a method that awaits must itself be async, and
// blocking on .Result is how a deadlock is introduced.
public async Task<Order?> LoadAsync(string id, CancellationToken cancellationToken)
{
    var response = await _http.GetAsync($"/api/orders/{id}", cancellationToken);
    response.EnsureSuccessStatusCode();
    return await response.Content.ReadFromJsonAsync<Order>(cancellationToken);
}`,
  },
  {
    id: "cs-async-parallel",
    title: "Await two things at once",
    level: 4,
    tags: ["async"],
    code: `// Start both, then await. Awaiting each in turn would make the total
// wait the sum rather than the larger of the two.
var ordersTask = LoadOrdersAsync(cancellationToken);
var profileTask = LoadProfileAsync(cancellationToken);
await Task.WhenAll(ordersTask, profileTask);`,
  },
  {
    id: "cs-cancellation",
    title: "Pass the cancellation token down",
    level: 4,
    tags: ["async"],
    code: `// A token that is accepted and then ignored is worse than none: the
// caller believes the work can be stopped when it cannot.
await foreach (var order in _repository.StreamAsync(cancellationToken))
{
    await ProcessAsync(order, cancellationToken);
}`,
  },
  {
    id: "cs-configureawait",
    title: "ConfigureAwait, and where it belongs",
    level: 5,
    tags: ["async"],
    code: `// In library code, so the continuation does not have to come back to the
// caller's context. In application code it is usually unnecessary noise.
var payload = await response.Content.ReadAsStringAsync().ConfigureAwait(false);`,
  },
  {
    id: "cs-using",
    title: "A using declaration",
    level: 3,
    tags: ["basics"],
    code: `// Disposed at the end of the enclosing scope, with no extra block and no
// extra indentation. The statement form is worth forgetting.
using var stream = File.OpenRead(path);
using var reader = new StreamReader(stream);`,
  },
  {
    id: "cs-exception",
    title: "Catch what you can handle",
    level: 3,
    tags: ["errors"],
    code: `// The when clause filters without unwinding the stack, so a rethrow is
// unnecessary and the original stack trace survives.
try
{
    await SaveAsync(order, cancellationToken);
}
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.Conflict)
{
    _logger.LogWarning(ex, "Order {OrderId} already exists", order.Id);
}`,
  },
  {
    id: "cs-custom-exception",
    title: "An exception type of your own",
    level: 3,
    tags: ["errors"],
    code: `// The inner exception is the part that gets dropped most often, and it
// is the part that says what actually went wrong.
public class OrderNotFoundException : Exception
{
    public OrderNotFoundException(string id, Exception? inner = null)
        : base($"Order {id} was not found", inner)
    {
        Id = id;
    }

    public string Id { get; }
}`,
  },
  {
    id: "cs-di",
    title: "Constructor injection",
    level: 3,
    tags: ["structure"],
    code: `// The dependencies are visible in the signature, which is what makes the
// class testable without a framework.
public sealed class OrderService(IOrderRepository repository, ILogger<OrderService> logger)
{
    private readonly IOrderRepository _repository = repository;
    private readonly ILogger<OrderService> _logger = logger;
}`,
  },
  {
    id: "cs-generic-constraint",
    title: "A generic method with constraints",
    level: 4,
    tags: ["structure"],
    code: `// The constraints are what make the body legal: new() allows the
// construction, and the interface allows the call.
public static T Load<T>(string json)
    where T : IParsable<T>, new()
{
    return JsonSerializer.Deserialize<T>(json) ?? new T();
}`,
  },
  {
    id: "cs-extension-method",
    title: "An extension method",
    level: 4,
    tags: ["structure"],
    code: `// A static method on a static class, with this on the first parameter.
// It reads as a method on the type without modifying it.
public static class OrderExtensions
{
    public static bool IsPaid(this Order order) => order.Status == OrderStatus.Paid;
}`,
  },
  {
    id: "cs-yield",
    title: "Produce a sequence lazily",
    level: 4,
    tags: ["linq"],
    code: `// yield return builds an iterator: nothing runs until the caller asks
// for the next element, and nothing is held that has not been asked for.
public static IEnumerable<int> Fibonacci()
{
    var (previous, current) = (0, 1);
    while (true)
    {
        yield return current;
        (previous, current) = (current, previous + current);
    }
}`,
  },
  {
    id: "cs-test",
    title: "A unit test",
    level: 3,
    tags: ["testing"],
    code: `// Arrange, act, assert — separated by blank lines rather than comments,
// so the shape is visible without anything being said about it.
[Fact]
public async Task FindAsync_ReturnsNull_WhenTheOrderIsMissing()
{
    var repository = new InMemoryOrderRepository();

    var order = await repository.FindAsync("missing", CancellationToken.None);

    Assert.Null(order);
}`,
  },
  {
    id: "cs-theory",
    title: "One test over several inputs",
    level: 4,
    tags: ["testing"],
    code: `// Three named cases in the report rather than one test with a loop, so a
// failure says which input caused it.
[Theory]
[InlineData("basic", 7.99)]
[InlineData("standard", 12.99)]
[InlineData("premium", 19.99)]
public void PriceOf_ReturnsThePublishedPrice(string plan, decimal expected)
{
    Assert.Equal(expected, Pricing.PriceOf(plan));
}`,
  },
];
