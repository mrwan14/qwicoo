import type { LocaleCode } from "@/lib/i18n/locale-text";

export type DictionaryNode = string | readonly DictionaryNode[] | { readonly [key: string]: DictionaryNode };

/** Arabic must mirror the English tree. A missing key is a type error. */
export type DictShape<T> = T extends string
  ? string
  : T extends readonly (infer Item)[]
    ? readonly DictShape<Item>[]
    : T extends Record<string, unknown>
      ? { [Key in keyof T]: DictShape<T[Key]> }
      : T;

export function defineDictionary<T extends DictionaryNode>(en: T, ar: DictShape<T>): Record<LocaleCode, T> {
  return { en, ar: ar as T };
}

/** Replace `{name}` placeholders. Unknown names stay visible so a typo is obvious. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}
