import { DOUBLE_QUOTE_ESCAPES } from "./constants.ts";
import type { TokenState } from "./types.ts";

const consumeCharacter = (state: TokenState, char: string, next?: string): TokenState => {
  if (state.skip) return { ...state, skip: false };

  if (char === "\\" && state.quote !== "'") {
    if (next === undefined) throw new Error("Trailing escape in workspace arguments.");
    if (state.quote === '"' && !DOUBLE_QUOTE_ESCAPES.includes(next)) return { ...state, value: state.value + char };

    return {
      ...state,
      value: state.value + (next === "\n" ? "" : next),
      started: state.started || next !== "\n",
      skip: true,
    };
  }

  if (state.quote)
    return char === state.quote ? { ...state, quote: undefined } : { ...state, value: state.value + char };

  if (char === "'" || char === '"') return { ...state, quote: char, started: true };

  if (/\s/.test(char))
    return {
      ...state,
      args: state.started ? [...state.args, state.value] : state.args,
      value: "",
      started: false,
    };

  return { ...state, value: state.value + char, started: true };
};

export const splitArgs = (input: string): string[] => {
  const state = input
    .split("")
    .reduce<TokenState>((state, char, index) => consumeCharacter(state, char, input[index + 1]), {
      args: [],
      value: "",
      started: false,
      skip: false,
    });
  if (state.quote) throw new Error("Unclosed quote in workspace arguments.");

  return state.started ? [...state.args, state.value] : state.args;
};
