import type { Check } from "./types.ts";

export const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const string: Check = value => typeof value === "string" && !value.includes("\0");

export const nonempty: Check = value => string(value) && (value as string).trim().length > 0;

export const number: Check = value => typeof value === "number" && Number.isFinite(value) && value >= 0;

export const integer: Check = value => number(value) && Number.isSafeInteger(value);

export const oneOf =
  (...values: unknown[]): Check =>
  value =>
    values.includes(value);

export const array =
  (check: Check): Check =>
  value =>
    Array.isArray(value) && value.every(check);

export const map =
  (check: Check): Check =>
  value =>
    record(value) && Object.values(value).every(check);

export const object =
  (required: Record<string, Check>, optional: Record<string, Check> = {}): Check =>
  value =>
    record(value) &&
    Object.entries(required).every(([key, check]) => Object.hasOwn(value, key) && check(value[key])) &&
    Object.keys(value).every(
      key =>
        Object.hasOwn(required, key) ||
        (Object.hasOwn(optional, key) && (value[key] === undefined || optional[key]!(value[key]))),
    );
