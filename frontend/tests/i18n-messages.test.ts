import { describe, expect, it } from "vitest";

import de from "@/messages/de.json";
import en from "@/messages/en.json";

// Flattens nested objects and arrays to "a.b.c" / "a.steps.0.title" -> string.
function flatten(messages: object, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(messages) as [string, unknown][]) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[path] = value;
    else Object.assign(result, flatten(value as object, path));
  }
  return result;
}

// ICU argument names, e.g. "{count}" or "{count, plural, ...}" -> "count".
function placeholders(message: string): string[] {
  const names = new Set<string>();
  for (const match of message.matchAll(/\{\s*([A-Za-z_][\w]*)/g)) names.add(match[1]);
  return [...names].sort();
}

const english = flatten(en);
const german = flatten(de);

describe("translation files", () => {
  it("de.json has every key of en.json", () => {
    const missing = Object.keys(english).filter((key) => !(key in german));
    expect(missing, "Keys missing from de.json").toEqual([]);
  });

  it("de.json has no keys that en.json lacks", () => {
    const extra = Object.keys(german).filter((key) => !(key in english));
    expect(extra, "Keys missing from en.json").toEqual([]);
  });

  it("has no empty translations", () => {
    const empty = [...Object.entries(english), ...Object.entries(german)]
      .filter(([, value]) => value.trim() === "")
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("uses the same placeholders in both languages", () => {
    const mismatched = Object.keys(english)
      .filter((key) => key in german)
      .filter((key) => placeholders(english[key]).join() !== placeholders(german[key]).join());
    expect(mismatched, "Keys whose {placeholders} differ").toEqual([]);
  });
});
