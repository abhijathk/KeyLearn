import { type Snippet } from "../types.ts";

/**
 * Go, formatted by gofumpt.
 *
 * The one language here whose formatting was never up for discussion: gofmt
 * shipped with the first release, everybody runs it, and it indents with tabs.
 * These snippets therefore contain real tab characters — the only corpus that
 * does — because a Go corpus written with spaces would be teaching something
 * that no Go file has ever looked like.
 *
 * gofumpt rather than gofmt: a strict superset, so anything it accepts gofmt
 * accepts, and it decides a handful of cases gofmt leaves open.
 */
export const goLang: readonly Snippet[] = [
  {
    id: "go-declare",
    title: "The two ways to declare a variable",
    level: 1,
    tags: ["basics"],
    scope: "statement",
    code: `// The short form only works inside a function; var works anywhere and is
// what you need when the zero value is the starting point.
name := "Ada"
var attempts int`,
  },
  {
    id: "go-zero-value",
    title: "Every type has a usable zero value",
    level: 2,
    tags: ["basics"],
    code: `// A nil map cannot be written to, but a nil slice can be appended to and
// a zero Mutex is ready to lock. Designing around this is idiomatic Go.
var (
	orders []Order
	mu     sync.Mutex
)`,
  },
  {
    id: "go-func-multiple-returns",
    title: "A function that returns a value and an error",
    level: 2,
    tags: ["basics", "errors"],
    code: `// The error comes last, always. Go has no exceptions, so this signature
// is how every fallible operation in the language is written.
func Parse(input string) (int, error) {
	return strconv.Atoi(strings.TrimSpace(input))
}`,
  },
  {
    id: "go-error-check",
    title: "The three lines you will type most",
    level: 2,
    tags: ["errors"],
    scope: "statement",
    code: `// Checked immediately and returned immediately. It is verbose, and it is
// also why a Go program rarely fails in a place far from the cause.
quantity, err := Parse(input)
if err != nil {
	return err
}`,
  },
  {
    id: "go-error-wrap",
    title: "Wrap an error with context",
    level: 3,
    tags: ["errors"],
    scope: "statement",
    code: `// The %w verb keeps the original reachable by errors.Is and errors.As.
// %v would flatten it to a string and lose that.
if err := store.Save(order); err != nil {
	return fmt.Errorf("saving order %s: %w", order.ID, err)
}`,
  },
  {
    id: "go-errors-is-as",
    title: "errors.Is and errors.As",
    level: 4,
    tags: ["errors"],
    scope: "statement",
    code: `// Is compares against a sentinel through the whole wrap chain; As finds
// a specific type in it and assigns. Comparing with == misses both.
if errors.Is(err, sql.ErrNoRows) {
	return nil, ErrNotFound
}

var pathErr *fs.PathError
if errors.As(err, &pathErr) {
	log.Printf("failed on %s", pathErr.Path)
}`,
  },
  {
    id: "go-sentinel-error",
    title: "A sentinel error",
    level: 3,
    tags: ["errors"],
    code: `// Declared once at package level so callers can compare against it. The
// Err prefix is the convention and is worth following exactly.
var ErrNotFound = errors.New("order not found")`,
  },
  {
    id: "go-custom-error",
    title: "An error type of your own",
    level: 4,
    tags: ["errors"],
    code: `// Anything with an Error() string method is an error. Adding Unwrap is
// what puts it into the chain errors.Is walks.
type ValidationError struct {
	Field string
	Err   error
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("%s: %v", e.Field, e.Err)
}

func (e *ValidationError) Unwrap() error { return e.Err }`,
  },
  {
    id: "go-struct",
    title: "A struct, with its tags",
    level: 2,
    tags: ["types"],
    code: `// The tags are read by encoding/json at run time. omitempty leaves the
// field out entirely when it holds its zero value.
type Order struct {
	ID       string    \`json:"id"\`
	Quantity int       \`json:"quantity"\`
	Total    float64   \`json:"total,omitempty"\`
	Created  time.Time \`json:"created_at"\`
}`,
  },
  {
    id: "go-method",
    title: "A method, and which receiver to use",
    level: 3,
    tags: ["types"],
    code: `// A pointer receiver when the method mutates or the struct is large; a
// value receiver otherwise. Mixing the two on one type is a smell.
func (o *Order) ApplyDiscount(fraction float64) {
	o.Total *= 1 - fraction
}`,
  },
  {
    id: "go-constructor",
    title: "A constructor function",
    level: 3,
    tags: ["types"],
    code: `// Go has no constructors, so the convention is a New function returning
// the type — or a pointer to it, when the zero value is not enough.
func NewOrder(id string) *Order {
	return &Order{ID: id, Quantity: 1, Created: time.Now()}
}`,
  },
  {
    id: "go-interface",
    title: "An interface, kept small",
    level: 3,
    tags: ["interfaces"],
    code: `// Satisfied implicitly: nothing declares that it implements this. The
// proverb is that the bigger the interface, the weaker the abstraction.
type Repository interface {
	Find(ctx context.Context, id string) (*Order, error)
	Save(ctx context.Context, order *Order) error
}`,
  },
  {
    id: "go-interface-consumer",
    title: "Define the interface where it is used",
    level: 5,
    tags: ["interfaces"],
    code: `// The consumer declares what it needs, so a package can be depended on
// without depending on the implementation's package at all.
type orderFinder interface {
	Find(ctx context.Context, id string) (*Order, error)
}

func Summarise(ctx context.Context, f orderFinder, id string) (string, error) {
	order, err := f.Find(ctx, id)
	if err != nil {
		return "", err
	}
	return order.ID, nil
}`,
  },
  {
    id: "go-type-switch",
    title: "A type switch",
    level: 4,
    tags: ["interfaces"],
    scope: "statement",
    code: `// The binding takes the concrete type in each branch, so no assertion is
// needed inside it.
switch v := value.(type) {
case string:
	return len(v)
case []Order:
	return len(v)
default:
	return 0
}`,
  },
  {
    id: "go-slice-append",
    title: "Slices, and the capacity you should reserve",
    level: 3,
    tags: ["collections"],
    scope: "statement",
    code: `// make with a length of zero and a capacity of len(orders) means append
// never has to reallocate and copy.
ids := make([]string, 0, len(orders))
for _, order := range orders {
	ids = append(ids, order.ID)
}`,
  },
  {
    id: "go-slice-aliasing",
    title: "A slice shares its backing array",
    level: 5,
    tags: ["collections"],
    scope: "statement",
    code: `// Appending to a re-sliced slice can overwrite the original's elements.
// The three-index form caps the capacity so append must allocate instead.
head := orders[:2:2]`,
  },
  {
    id: "go-map",
    title: "A map, and the comma-ok read",
    level: 2,
    tags: ["collections"],
    scope: "statement",
    code: `// Reading a missing key gives the zero value, not an error, so the second
// return is the only way to tell "absent" from "present and zero".
counts := make(map[string]int)
if n, ok := counts[country]; ok {
	fmt.Println(n)
}`,
  },
  {
    id: "go-map-iteration",
    title: "Map iteration order is random on purpose",
    level: 4,
    tags: ["collections"],
    scope: "statement",
    code: `// Deliberately randomised, so nobody can depend on it. To produce stable
// output, collect the keys and sort them.
keys := slices.Collect(maps.Keys(counts))
slices.Sort(keys)`,
  },
  {
    id: "go-range",
    title: "range, and the values it gives you",
    level: 2,
    tags: ["basics"],
    scope: "statement",
    code: `// Over a slice it yields index and value; over a map, key and value. The
// underscore discards the one you do not want.
for i, order := range orders {
	fmt.Printf("%d. %s\\n", i+1, order.ID)
}`,
  },
  {
    id: "go-defer",
    title: "defer, and when it runs",
    level: 3,
    tags: ["basics"],
    scope: "statement",
    code: `// At the end of the function, not the block, and in reverse order. The
// arguments are evaluated now, which is the part that catches people out.
file, err := os.Open(path)
if err != nil {
	return err
}
defer file.Close()`,
  },
  {
    id: "go-goroutine-waitgroup",
    title: "Run work concurrently and wait for it",
    level: 4,
    tags: ["concurrency"],
    code: `// The Add must happen before the goroutine starts, and the Done must be
// deferred — otherwise a panic in the body hangs the Wait forever.
var wg sync.WaitGroup
for _, id := range ids {
	wg.Add(1)
	go func() {
		defer wg.Done()
		process(id)
	}()
}
wg.Wait()`,
  },
  {
    id: "go-channel",
    title: "A channel, and closing it",
    level: 4,
    tags: ["concurrency"],
    scope: "statement",
    code: `// The sender closes, never the receiver, and a range over a channel ends
// when it is closed. Closing twice panics.
results := make(chan string, len(ids))
go func() {
	defer close(results)
	for _, id := range ids {
		results <- process(id)
	}
}()

for r := range results {
	fmt.Println(r)
}`,
  },
  {
    id: "go-select",
    title: "select, for whichever is ready first",
    level: 5,
    tags: ["concurrency"],
    scope: "statement",
    code: `// The context case is what makes this cancellable. Without it, a slow
// producer blocks the goroutine until the process ends.
select {
case r := <-results:
	return r, nil
case <-ctx.Done():
	return "", ctx.Err()
}`,
  },
  {
    id: "go-mutex",
    title: "A mutex, guarding the field beneath it",
    level: 4,
    tags: ["concurrency"],
    code: `// Declared immediately above what it protects, which is the convention
// that makes the scope of the lock obvious.
type Cache struct {
	mu      sync.RWMutex
	entries map[string]*Order
}

func (c *Cache) Get(id string) (*Order, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	order, ok := c.entries[id]
	return order, ok
}`,
  },
  {
    id: "go-context",
    title: "Context first, always",
    level: 3,
    tags: ["concurrency"],
    code: `// The first parameter, named ctx, never stored in a struct. It carries
// cancellation and deadlines down the whole call tree.
func Load(ctx context.Context, id string) (*Order, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	return fetch(ctx, id)
}`,
  },
  {
    id: "go-json-decode",
    title: "Decode JSON into a struct",
    level: 3,
    tags: ["stdlib"],
    code: `// A pointer, because Unmarshal has to write into it. Passing the value
// compiles and then silently does nothing.
var order Order
if err := json.Unmarshal(data, &order); err != nil {
	return fmt.Errorf("decoding order: %w", err)
}`,
  },
  {
    id: "go-http-handler",
    title: "An HTTP handler",
    level: 4,
    tags: ["stdlib"],
    code: `// Set the header before writing the status, and the status before the
// body — once anything is written the header is already sent.
func handleOrder(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(order)
}`,
  },
  {
    id: "go-http-client",
    title: "An HTTP request with a context",
    level: 4,
    tags: ["stdlib"],
    scope: "statement",
    code: `// http.Get has no context and no timeout, so a hung server hangs the
// program. NewRequestWithContext is the form worth defaulting to.
req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
if err != nil {
	return err
}
resp, err := http.DefaultClient.Do(req)
if err != nil {
	return err
}
defer resp.Body.Close()`,
  },
  {
    id: "go-table-test",
    title: "A table-driven test",
    level: 4,
    tags: ["testing"],
    code: `// The Go way to write tests. t.Run gives each case its own name in the
// output, so a failure says which input caused it.
func TestParse(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  int
	}{
		{"plain", "42", 42},
		{"padded", "  42  ", 42},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Parse(tt.input)
			if err != nil {
				t.Fatalf("Parse(%q) returned %v", tt.input, err)
			}
			if got != tt.want {
				t.Errorf("Parse(%q) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}`,
  },
  {
    id: "go-test-helper",
    title: "Errorf or Fatalf",
    level: 3,
    tags: ["testing"],
    scope: "statement",
    code: `// Fatalf stops this test; Errorf records the failure and carries on. Use
// Fatal when continuing would only produce noise.
if got != want {
	t.Errorf("Subtotal() = %v, want %v", got, want)
}`,
  },
  {
    id: "go-generics",
    title: "A generic function",
    level: 5,
    tags: ["basics"],
    code: `// The constraint says what the type must support. cmp.Ordered covers
// every type the comparison operators work on.
func Max[T cmp.Ordered](values []T) (T, bool) {
	var zero T
	if len(values) == 0 {
		return zero, false
	}
	return slices.Max(values), true
}`,
  },
  {
    id: "go-options",
    title: "Functional options",
    level: 5,
    tags: ["types"],
    code: `// Go has no default arguments, so this is how a constructor grows new
// settings without breaking every existing call.
type Option func(*Client)

func WithTimeout(d time.Duration) Option {
	return func(c *Client) { c.timeout = d }
}`,
  },
];
