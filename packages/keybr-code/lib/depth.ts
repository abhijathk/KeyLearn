import {
  findRule,
  type Grammar,
  isAlt,
  isCond,
  isLit,
  isOpt,
  isRef,
  isSeq,
  isSpan,
  type Prod,
} from "./ast.ts";

/**
 * How deeply a production must still nest before it can stop.
 *
 * The generator needs this to get out of a hole. Rules like a type argument, an
 * array element or a keyword argument refer back to themselves, so a walk that
 * picks alternatives at random keeps descending until it runs out of
 * characters — which is why Python, Rust and TypeScript came out as one
 * enormous half-finished expression while flat grammars like shell and regex
 * came out clean. Knowing the cheapest way down lets it choose that way once it
 * has gone far enough.
 *
 * A rule that can only ever expand into more rules is unbounded, and scores
 * Infinity; the caller treats that as "never pick this if there is any
 * alternative".
 */
export type Depths = ReadonlyMap<string, number>;

const cache = new WeakMap<Grammar, Depths>();

export function ruleDepths(grammar: Grammar): Depths {
  let depths = cache.get(grammar);
  if (depths == null) {
    depths = compute(grammar);
    cache.set(grammar, depths);
  }
  return depths;
}

/** Every rule name in the grammar, including the ones it composes in. */
function ruleNames(grammar: Grammar, into = new Set<string>()): Set<string> {
  for (const name of Object.keys(grammar.rules)) {
    into.add(name);
  }
  for (const composed of grammar.composes) {
    ruleNames(composed, into);
  }
  return into;
}

function compute(grammar: Grammar): Depths {
  const depths = new Map<string, number>();
  for (const name of ruleNames(grammar)) {
    depths.set(name, Infinity);
  }
  // Relaxation rather than recursion: the references are cyclic by nature, so
  // there is no order to visit them in. Each pass lets a rule learn from the
  // ones it refers to; the values only ever fall, so it settles. Bounded by
  // the rule count, which is the longest chain that can exist.
  const passes = depths.size + 1;
  for (let i = 0; i < passes; i++) {
    let changed = false;
    for (const name of depths.keys()) {
      const rule = findRule(grammar, name);
      if (rule == null) {
        continue;
      }
      const next = costOf(rule, depths);
      if (next < (depths.get(name) ?? Infinity)) {
        depths.set(name, next);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  return depths;
}

/** How deep this production nests, given what is known about the rules so far. */
export function costOf(p: Prod, depths: Depths): number {
  if (isLit(p)) {
    return 0;
  }
  if (isSpan(p)) {
    return costOf(p.span, depths);
  }
  if (isOpt(p)) {
    return 0; // Skippable, so it costs nothing to stop here.
  }
  if (isSeq(p)) {
    // Every child is emitted, so the sequence is as deep as its deepest one.
    let max = 0;
    for (const child of p.seq) {
      max = Math.max(max, costOf(child, depths));
      if (max === Infinity) {
        break;
      }
    }
    return max;
  }
  if (isAlt(p)) {
    // Only one branch is taken, so the cheapest escape is what counts.
    let min = Infinity;
    for (const child of p.alt) {
      min = Math.min(min, costOf(child, depths));
      if (min === 0) {
        break;
      }
    }
    return min;
  }
  if (isRef(p)) {
    return 1 + (depths.get(p.ref) ?? Infinity);
  }
  if (isCond(p)) {
    return costOf(p.cond, depths); // Unpruned grammars only reach here in tests.
  }
  return 0;
}
