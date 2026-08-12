/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Shared corpus for the mapping characterization test and fixture generator.
// Values are positive magnitudes (the mappings operate on absolute value).
// Chosen to exercise every branch: exact powers of two, near-boundary
// non-powers, the subnormal edge, and extreme magnitudes.

const scales = [-10, -5, -2, -1, 0, 1, 2, 5, 10, 15, 20];

function buildValues() {
  const values = [];

  // exact powers of two across the normal exponent range
  for (const k of [-1022, -1021, -1000, -100, -10, -2, -1, 0, 1, 2, 10, 100, 1000, 1022, 1023]) {
    values.push(Math.pow(2, k));
  }

  // non-powers straddling bucket boundaries at several octaves
  for (const k of [-100, -1, 0, 1, 10, 100]) {
    const base = Math.pow(2, k);
    values.push(base * 1.0000000001, base * 1.5, base * 1.9999999999);
  }

  // hand-picked specifics, including the smallest double above 1
  values.push(1, 1.5, 2, 3, 4, 5, 8, 0.5, 0.75, 0.51, 0.26, 100, 1000, 1e6, 1e-6, 1 + Math.pow(2, -52));

  // edges of the representable normal range
  values.push(Math.pow(2, -1022), 1.0625 * Math.pow(2, -1022), Number.MIN_VALUE, Number.MAX_VALUE);

  return values;
}

module.exports = { scales, values: buildValues() };
