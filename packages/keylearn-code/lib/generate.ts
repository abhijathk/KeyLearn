import { LCG, type RNG } from "@keylearn/rand";
import { type StyledText } from "@keylearn/textinput";
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
import { costOf, ruleDepths } from "./depth.ts";
import { Output } from "./output.ts";

const lcg = LCG(1);

/**
 * Generates text from the given context-free grammar.
 */
export function generate(
  grammar: Grammar,
  {
    start = "start",
    output = new Output(),
    rng = lcg,
    maxDepth = 8,
  }: {
    readonly start?: string;
    readonly output?: Output;
    readonly rng?: RNG;
    /**
     * How many rule expansions deep to keep choosing freely.
     *
     * Past this the walk takes the cheapest way out instead. Without it a
     * self-referential rule — a type argument, an array element, a keyword
     * argument — recurses until the character limit stops it, which produced
     * one enormous unfinished expression rather than a run of readable
     * statements. Eight is deep enough for a nested generic or a call inside a
     * call, and shallow enough that the result still looks like code someone
     * wrote.
     */
    readonly maxDepth?: number;
  } = {},
): StyledText {
  const cls = new Array<string>();
  const alts = new Map<readonly Prod[], Prod>();
  const depths = ruleDepths(grammar);
  let depth = 0;
  visit(getRule(start));
  return output.text;

  function visit(p: Prod): void {
    if (isCond(p)) {
      throw new Error(); // The grammar must be pruned at this point.
    }

    if (isSpan(p)) {
      cls.push(p.cls);
      visit(p.span);
      cls.pop();
      return;
    }

    if (isOpt(p)) {
      // Optionals are where the nesting comes from, so once we are deep enough
      // they are simply declined — the cheapest way to start climbing out.
      if (depth >= maxDepth) {
        return;
      }
      const { f = 1 } = p;
      if (f === 1 || f > rng()) {
        visit(p.opt);
      }
      return;
    }

    if (isSeq(p)) {
      for (const child of p.seq) {
        visit(child);
      }
      return;
    }

    if (isAlt(p)) {
      visit(choose(p.alt));
      return;
    }

    if (isRef(p)) {
      depth += 1;
      try {
        visit(getRule(p.ref));
      } finally {
        depth -= 1;
      }
      return;
    }

    if (isLit(p)) {
      output.append(p, cls.length > 0 ? cls.at(-1) : null);
      return;
    }

    throw new Error(); // Unreachable.
  }

  function getRule(name: string): Prod {
    const rule = findRule(grammar, name);
    if (rule == null) {
      throw new Error(
        process.env.NODE_ENV !== "production"
          ? `Unknown rule [${name}]`
          : undefined,
      );
    }
    return rule;
  }

  function choose(a: readonly Prod[]): Prod {
    // Too deep to keep wandering: take whichever branch terminates soonest.
    // Repetition does not matter here — being able to finish the statement
    // does.
    if (depth >= maxDepth && a.length > 1) {
      let best = a[0];
      let bestCost = costOf(best, depths);
      for (let i = 1; i < a.length && bestCost > 0; i++) {
        const cost = costOf(a[i], depths);
        if (cost < bestCost) {
          best = a[i];
          bestCost = cost;
        }
      }
      return best;
    }
    if (a.length > 1) {
      const prev = alts.get(a);
      while (true) {
        const next = a[Math.floor(rng() * a.length)];
        if (prev !== next) {
          alts.set(a, next);
          return next;
        }
      }
    } else {
      return a[0];
    }
  }
}
