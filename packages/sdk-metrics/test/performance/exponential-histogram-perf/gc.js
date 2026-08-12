/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Allocation/GC probe for the exponential-histogram mapping hot path. Throughput
// alone under-credits allocation changes (V8 can scalar-replace short-lived
// objects), so count GC events over a fixed workload instead.
//
// Run with: node --expose-gc test/performance/exponential-histogram-perf/gc.js
// Optional: GC_ITER=20000000 to change the iteration count.

const { performance, PerformanceObserver } = require('perf_hooks');
const {
  getMapping,
} = require('../../../build/src/aggregator/exponential-histogram/mapping/getMapping.js');
const { lognormal, SIZE } = require('./workload.js');

const log20 = getMapping(20);
const ITER = Number(process.env.GC_ITER || 10_000_000);

let gcCount = 0;
let gcTimeMs = 0;
const obs = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    gcCount++;
    gcTimeMs += entry.duration;
  }
});
obs.observe({ entryTypes: ['gc'] });

if (global.gc) global.gc();

let sink = 0;
const t0 = performance.now();
for (let i = 0; i < ITER; i++) {
  sink += log20.mapToIndex(lognormal[i % SIZE]);
}
const t1 = performance.now();

// Let queued GC observer callbacks flush before reporting.
setImmediate(() => {
  obs.disconnect();
  const ms = t1 - t0;
  console.log(
    JSON.stringify(
      {
        target: 'LogarithmMapping(20).mapToIndex',
        iterations: ITER,
        ms: +ms.toFixed(1),
        opsPerSec: Math.round(ITER / (ms / 1000)),
        gcCount,
        gcTimeMs: +gcTimeMs.toFixed(1),
        exposeGc: Boolean(global.gc),
        sink: sink === Infinity ? sink : undefined,
      },
      null,
      1
    )
  );
});
