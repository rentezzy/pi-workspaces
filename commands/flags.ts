import { ALLOWED_FLAGS, BOOLEAN_FLAGS } from "./constants.ts";
import type { ArgumentState } from "./types.ts";

export const parseFlags = (verb: string, args: string[]): ArgumentState =>
  args.reduce<ArgumentState>(
    (state, arg, index) => {
      if (state.skip) return { ...state, skip: false };
      if (!state.literal && arg === "--") return { ...state, literal: true };
      if (state.literal || !arg.startsWith("--")) return { ...state, positional: [...state.positional, arg] };

      const equals = arg.indexOf("=");
      const key = arg.slice(2, equals < 0 ? undefined : equals);
      if (!ALLOWED_FLAGS[verb]!.includes(key)) throw new Error(`Unsupported flag ${arg} for ${verb}.`);
      if (Object.hasOwn(state.flags, key)) throw new Error(`Duplicate flag --${key}.`);

      if (BOOLEAN_FLAGS.includes(key)) {
        if (equals >= 0) throw new Error(`--${key} takes no value.`);
        return { ...state, flags: { ...state.flags, [key]: true } };
      }

      const value = equals >= 0 ? arg.slice(equals + 1) : args[index + 1];
      if (!value || (equals < 0 && value.startsWith("--"))) throw new Error(`--${key} requires a value.`);

      return { ...state, flags: { ...state.flags, [key]: value }, skip: equals < 0 };
    },
    { flags: {}, positional: [], literal: false, skip: false },
  );
