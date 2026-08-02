import { type Snippet } from "../types.ts";

/**
 * React in TypeScript, as JSX and TSX are actually written.
 *
 * Modern React only: function components, hooks, no classes. The recurring
 * theme is the one people get wrong for years — an effect is for
 * synchronising with something outside React, not for computing a value from
 * props. Half the hook bugs anyone ever writes are an effect doing arithmetic.
 */
export const reactTsx: readonly Snippet[] = [
  {
    id: "rx-component",
    title: "A component with typed props",
    level: 1,
    tags: ["component"],
    code: `// The props type is declared inline for a component this small; pull it
// out into a named type once it grows past a line or two.
export function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}`,
  },
  {
    id: "rx-children",
    title: "A component that wraps other content",
    level: 1,
    tags: ["component"],
    code: `// ReactNode, not JSX.Element: children can be a string, a number, an
// array or null, and only ReactNode admits all of them.
export function Card({ children }: { children: ReactNode }) {
  return <section className="card">{children}</section>;
}`,
  },
  {
    id: "rx-props-default",
    title: "Default a prop in the signature",
    level: 1,
    tags: ["component"],
    code: `// Destructuring defaults replaced defaultProps years ago, and unlike
// defaultProps they are visible to TypeScript.
export function Button({ label, variant = "primary" }: ButtonProps) {
  return <button className={variant}>{label}</button>;
}`,
  },
  {
    id: "rx-conditional",
    title: "Render something only when it applies",
    level: 1,
    tags: ["jsx"],
    code: `// Guard with a boolean, not a number: {count && <Badge />} renders a
// literal 0 on screen when count is zero, which is the classic JSX bug.
export function Inbox({ unread }: { unread: number }) {
  return <nav>{unread > 0 && <Badge count={unread} />}</nav>;
}`,
  },
  {
    id: "rx-list",
    title: "Render a list with stable keys",
    level: 1,
    tags: ["jsx"],
    code: `// The key must identify the item, not its position. An array index as
// key makes React reuse the wrong row the moment the list is reordered.
export function TitleList({ titles }: { titles: Title[] }) {
  return (
    <ul>
      {titles.map((title) => (
        <li key={title.id}>{title.name}</li>
      ))}
    </ul>
  );
}`,
  },
  {
    id: "rx-fragment",
    title: "Return several elements without a wrapper",
    level: 2,
    tags: ["jsx"],
    code: `// A fragment adds nothing to the DOM, which matters inside a grid or a
// table where a stray div would break the layout.
export function NameCells({ person }: { person: Person }) {
  return (
    <>
      <td>{person.given}</td>
      <td>{person.family}</td>
    </>
  );
}`,
  },
  {
    id: "rx-state",
    title: "Local state with useState",
    level: 1,
    tags: ["hooks", "state"],
    code: `// The functional update form is the safe one: it sees the latest value
// even when several updates are batched into one render.
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((n) => n + 1)}>{count}</button>;
}`,
  },
  {
    id: "rx-state-object",
    title: "Update one field of an object in state",
    level: 2,
    tags: ["hooks", "state"],
    code: `// State must be replaced, never mutated: React compares by identity, so
// editing the old object in place changes nothing on screen.
setProfile((previous) => ({ ...previous, displayName: "Ada" }));`,
  },
  {
    id: "rx-derived",
    title: "Derive a value instead of storing it",
    level: 2,
    tags: ["hooks", "state"],
    code: `// No state and no effect. A value computable from props during render
// should be computed during render — storing it invites the two to disagree.
const fullName = person.given + " " + person.family;
const isComplete = todos.every((todo) => todo.done);`,
  },
  {
    id: "rx-effect",
    title: "An effect that synchronises with the outside world",
    level: 2,
    tags: ["hooks", "effect"],
    code: `// What effects are actually for: something outside React that has to be
// set up and taken down again. The cleanup is not optional.
useEffect(() => {
  const id = window.setInterval(() => setNow(Date.now()), 1000);
  return () => window.clearInterval(id);
}, []);`,
  },
  {
    id: "rx-effect-listener",
    title: "Subscribe and unsubscribe",
    level: 2,
    tags: ["hooks", "effect"],
    code: `// Returning the removal keeps the listener count from growing every
// time the component remounts — the leak nobody notices until it is slow.
useEffect(() => {
  const onResize = () => setWidth(window.innerWidth);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);`,
  },
  {
    id: "rx-effect-deps",
    title: "Re-run an effect when its inputs change",
    level: 3,
    tags: ["hooks", "effect"],
    code: `// Every value the effect reads belongs in the array. Leaving one out to
// silence a re-render is how an effect ends up working with a stale value.
useEffect(() => {
  void loadProfile(profileId).then(setProfile);
}, [profileId]);`,
  },
  {
    id: "rx-effect-abort",
    title: "Cancel a request the component no longer needs",
    level: 4,
    tags: ["hooks", "effect"],
    code: `// Without the abort, a slow first request can resolve after a fast
// second one and overwrite newer data with older.
useEffect(() => {
  const controller = new AbortController();
  void fetch("/api/profile", { signal: controller.signal })
    .then((response) => response.json())
    .then(setProfile)
    .catch(() => {});
  return () => controller.abort();
}, [profileId]);`,
  },
  {
    id: "rx-memo",
    title: "Remember an expensive calculation",
    level: 3,
    tags: ["hooks", "performance"],
    code: `// Only worth it when the work is genuinely expensive: useMemo is not
// free, and wrapping a string concatenation costs more than it saves.
const sorted = useMemo(
  () => [...titles].sort((a, b) => a.name.localeCompare(b.name)),
  [titles],
);`,
  },
  {
    id: "rx-callback",
    title: "Keep a function identity stable",
    level: 3,
    tags: ["hooks", "performance"],
    code: `// Pointless unless the child is memoised or the function is in a
// dependency array — those are the only two things that compare identity.
const handleSelect = useCallback((id: string) => {
  setSelected(id);
}, []);`,
  },
  {
    id: "rx-ref",
    title: "Reach a DOM node",
    level: 2,
    tags: ["hooks", "ref"],
    code: `// A ref is the escape hatch to the DOM. Changing one does not re-render,
// which is exactly why it suits focus and measurement.
const input = useRef<HTMLInputElement>(null);
useEffect(() => {
  input.current?.focus();
}, []);`,
  },
  {
    id: "rx-ref-value",
    title: "Hold a value across renders without re-rendering",
    level: 3,
    tags: ["hooks", "ref"],
    code: `// For anything the UI does not display — a timer handle, a previous
// value, a flag. State here would re-render for no visible reason.
const renders = useRef(0);
renders.current += 1;`,
  },
  {
    id: "rx-reducer",
    title: "A reducer for state with several transitions",
    level: 4,
    tags: ["hooks", "state"],
    code: `// Once the updates interact, a reducer puts them all in one place where
// they can be read together — and tested without rendering anything.
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "start":
      return { ...state, status: "loading" };
    case "loaded":
      return { status: "ready", items: action.items };
    case "failed":
      return { ...state, status: "error", message: action.message };
  }
}`,
  },
  {
    id: "rx-context",
    title: "Share a value without threading it through props",
    level: 4,
    tags: ["hooks", "context"],
    code: `// The null default plus a throwing hook turns "used outside the
// provider" from a confusing undefined into a message that says so.
const ThemeContext = createContext<Theme | null>(null);

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error("useTheme must be used inside a ThemeProvider.");
  }
  return theme;
}`,
  },
  {
    id: "rx-custom-hook",
    title: "A custom hook",
    level: 3,
    tags: ["hooks"],
    code: `// A hook is just a function that calls other hooks. The name has to
// start with "use" or the linter cannot check the rules for you.
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}`,
  },
  {
    id: "rx-controlled-input",
    title: "A controlled input",
    level: 2,
    tags: ["forms"],
    code: `// Value and onChange together. Supply one without the other and React
// warns that the field is read-only, which is precisely what it is.
<input
  value={query}
  onChange={(event) => setQuery(event.target.value)}
  placeholder="Search titles"
/>;`,
  },
  {
    id: "rx-form-submit",
    title: "Handle a form submission",
    level: 2,
    tags: ["forms"],
    code: `// preventDefault stops the browser navigating away. Keeping the button
// as type="submit" is what makes Enter work from inside any field.
function onSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  void save({ email });
}`,
  },
  {
    id: "rx-lift-state",
    title: "Lift state to the nearest common parent",
    level: 3,
    tags: ["state"],
    code: `// When two children need the same value, it belongs to whoever contains
// both. Duplicating it in each is how they come to disagree.
export function Filters() {
  const [range, setRange] = useState<Range>("month");
  return (
    <>
      <RangePicker value={range} onChange={setRange} />
      <Chart range={range} />
    </>
  );
}`,
  },
  {
    id: "rx-memo-component",
    title: "Skip re-rendering a child that has not changed",
    level: 4,
    tags: ["performance"],
    code: `// memo compares props shallowly, so it only helps when the props are
// stable — an inline object or arrow function defeats it every render.
export const Row = memo(function Row({ title }: { title: Title }) {
  return <li>{title.name}</li>;
});`,
  },
  {
    id: "rx-lazy",
    title: "Load a component only when it is shown",
    level: 4,
    tags: ["performance"],
    code: `// Splits the bundle at this boundary. The fallback is what the user
// looks at while the chunk arrives, so it deserves some thought.
const Settings = lazy(() => import("./Settings.tsx"));

<Suspense fallback={<LoadingProgress />}>
  <Settings />
</Suspense>;`,
  },
  {
    id: "rx-error-boundary",
    title: "Catch a render error before it blanks the page",
    level: 5,
    tags: ["component"],
    code: `// Still a class, because there is no hook for this. Without one, a
// thrown error unmounts the whole tree and leaves a white screen.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error !== null) {
      return <ErrorPage error={this.state.error} />;
    }
    return this.props.children;
  }
}`,
  },
  {
    id: "rx-portal",
    title: "Render outside the parent's DOM position",
    level: 4,
    tags: ["component"],
    code: `// A dialog inside a container with overflow or a transform is clipped by
// it however high the z-index. A portal is the only reliable way out.
createPortal(<Dialog onClose={close} />, document.body);`,
  },
  {
    id: "rx-props-spread",
    title: "Pass the remaining props through",
    level: 3,
    tags: ["component"],
    code: `// Spreading the rest keeps a wrapper honest: aria-label, id, data-* and
// every other attribute reach the element without being listed one by one.
export function Input({ label, ...rest }: InputProps) {
  return (
    <label>
      {label}
      <input {...rest} />
    </label>
  );
}`,
  },
  {
    id: "rx-generic-component",
    title: "A component that works with any item type",
    level: 5,
    tags: ["component", "types"],
    code: `// The generic flows from the items to the render function, so the
// callback's argument is typed without anybody writing it down.
export function List<T>({
  items,
  render,
}: {
  items: readonly T[];
  render: (item: T) => ReactNode;
}) {
  return (
    <ul>
      {items.map((item, i) => (
        <li key={i}>{render(item)}</li>
      ))}
    </ul>
  );
}`,
  },
  {
    id: "rx-class-names",
    title: "Build a class list conditionally",
    level: 2,
    tags: ["jsx"],
    code: `// clsx drops false and null, so a condition that fails contributes
// nothing rather than the string "false" or "undefined".
<button className={clsx(styles.button, active && styles.active)} />;`,
  },
];
