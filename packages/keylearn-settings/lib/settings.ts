import { isPlainObject } from "@keylearn/lang";
import { type AnyProp } from "./props.ts";

export type SettingsStorage = {
  load(): Promise<Settings>;
  store(settings: Settings): Promise<Settings>;
};

type Json = Record<string, unknown>;

let defaultJson: Json = createJson();
/**
 * The site's forced values (control centre phase 3.4): a prop here wins
 * over the learner's own stored value on every read, without touching what
 * they stored — lifting the override gives them their own choice back.
 */
let forcedJson: Json = createJson();
/** The forced props whose controls are removed from the settings screens too. */
let hiddenKeys: ReadonlySet<string> = new Set();

export class Settings {
  static addDefaults(settings: Settings): void {
    defaultJson = mergeJson(defaultJson, settings.#json);
  }

  /** Replaces the forced layer wholesale; `hidden` names the props to hide as well. */
  static setForced(settings: Settings, hidden: readonly string[] = []): void {
    forcedJson = cloneJson(settings.#json);
    hiddenKeys = new Set(hidden);
  }

  /** Whether the site decides this prop for every learner. */
  static isForced(prop: AnyProp<any>): boolean {
    return prop.key in forcedJson;
  }

  /** Whether the site decides this prop and hides its control as well. */
  static isHidden(prop: AnyProp<any>): boolean {
    return hiddenKeys.has(prop.key);
  }

  readonly #json: Json;
  readonly #isNew: boolean;

  constructor(json: Json = createJson(), isNew: boolean = false) {
    if (!isPlainObject(json)) {
      throw new TypeError();
    }
    this.#json = migrate(cloneJson(json));
    this.#isNew = isNew;
  }

  get isNew(): boolean {
    return this.#isNew;
  }

  get<T>(prop: AnyProp<T>, defaultValue?: T): T {
    return prop.fromJson(
      forcedJson[prop.key] ?? this.#json[prop.key] ?? defaultJson[prop.key],
      defaultValue,
    );
  }

  set<T>(prop: AnyProp<T>, value: T): Settings {
    return new Settings({ ...this.#json, [prop.key]: prop.toJson(value) });
  }

  reset(): Settings {
    return new Settings();
  }

  toJSON() {
    const entries = [];
    for (const key of Object.keys(this.#json).sort()) {
      entries.push([key, this.#json[key]]);
    }
    return Object.fromEntries(entries);
  }
}

function createJson(): Json {
  return Object.create(null);
}

function cloneJson(o: Json): Json {
  return Object.assign(createJson(), o);
}

function mergeJson(a: Json, b: Json): Json {
  return Object.assign(createJson(), a, b);
}

function migrate(json: Json): Json {
  return json;
}
