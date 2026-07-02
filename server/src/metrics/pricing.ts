/**
 * Estimated $/MTok price table, matched by substring of the model id.
 * Cache-write is billed at 1.25x input, cache-read at 0.1x input.
 * These are estimates for visualization — not billing-grade numbers.
 */
interface Price {
  input: number;
  output: number;
}

const PRICES: Array<[substr: string, price: Price]> = [
  ["fable", { input: 20, output: 100 }],
  ["mythos", { input: 20, output: 100 }],
  ["opus", { input: 15, output: 75 }],
  ["sonnet", { input: 3, output: 15 }],
  ["haiku", { input: 1, output: 5 }],
];

const DEFAULT_PRICE: Price = { input: 3, output: 15 };

export function priceFor(model: string): Price {
  const m = model.toLowerCase();
  for (const [substr, price] of PRICES) {
    if (m.includes(substr)) return price;
  }
  return DEFAULT_PRICE;
}

export interface Usage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export function estimateCostUSD(model: string, u: Usage): number {
  const p = priceFor(model);
  return (
    (u.input * p.input +
      u.output * p.output +
      u.cacheWrite * p.input * 1.25 +
      u.cacheRead * p.input * 0.1) /
    1_000_000
  );
}
