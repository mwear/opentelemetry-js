/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Deterministic value workloads shared by the exponential-histogram throughput
// and GC benchmarks. Seeded so runs are reproducible across branches.

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Latency-like positive values (Box-Muller lognormal). Median ~50, long right tail.
function makeLognormal(n, seed, mu, sigma) {
  const rnd = mulberry32(seed);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rnd(), 1e-12);
    const u2 = rnd();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    out[i] = Math.exp(mu + sigma * z);
  }
  return out;
}

// Values spanning ~2^-100 .. 2^100 to stress the exponent mapping and rescaling.
function makeWideRange(n, seed) {
  const rnd = mulberry32(seed);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rnd() * 200) - 100;
    out[i] = Math.pow(2, k) * (1 + rnd());
  }
  return out;
}

const SIZE = 4096;

module.exports = {
  SIZE,
  lognormal: makeLognormal(SIZE, 1, Math.log(50), 1.2),
  wideRange: makeWideRange(SIZE, 2),
};
