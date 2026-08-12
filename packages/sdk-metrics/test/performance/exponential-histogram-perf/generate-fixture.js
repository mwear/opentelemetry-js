/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Regenerates fixture.json from the CURRENT compiled mapping implementation.
// Run against the baseline commit to freeze behavior, then only re-run when a
// change is an intentional, reviewed behavior change.
//
// Usage: npm run compile && node test/performance/exponential-histogram-perf/generate-fixture.js

const fs = require('fs');
const path = require('path');
const {
  getMapping,
} = require('../../../build/src/aggregator/exponential-histogram/mapping/getMapping.js');
const { scales, values } = require('./corpus.js');

// Stringify so -0, Infinity, and NaN survive JSON round-trips.
function s(n) {
  return Object.is(n, -0) ? '-0' : String(n);
}

const records = [];
for (const scale of scales) {
  const mapping = getMapping(scale);
  for (const value of values) {
    let index;
    try {
      index = mapping.mapToIndex(value);
    } catch {
      index = 'ERR';
    }
    let lowerBoundary;
    try {
      lowerBoundary = index === 'ERR' ? 'ERR' : s(mapping.lowerBoundary(index));
    } catch {
      lowerBoundary = 'ERR';
    }
    records.push({ scale, value: s(value), index, lowerBoundary });
  }
}

const out = path.join(__dirname, 'fixture.json');
fs.writeFileSync(out, JSON.stringify(records, null, 1) + '\n');
console.log(`wrote ${records.length} records to ${out}`);
