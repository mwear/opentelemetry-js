/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Macro benchmark: drives the full metrics pipeline (public Histogram.record ->
// attribute processing -> storage -> exponential aggregation -> collect/export)
// so the float-bit-read change is measured amid real surrounding work, not in a
// tight mapToIndex loop. This is the honest check against JIT/microbench effects.
//
// Run: npm run compile && node test/performance/exponential-histogram-perf/macro.js

const { performance } = require('perf_hooks');
const {
  MeterProvider,
  AggregationType,
  InstrumentType,
} = require('../../../build/src');
const {
  TestMetricReader,
} = require('../../../build/test/export/TestMetricReader.js');
const { lognormal, SIZE } = require('./workload.js');

function makeAttrs(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      'http.route': `/api/resource/${i % 20}`,
      'http.method': i % 2 === 0 ? 'GET' : 'POST',
      'http.status_code': [200, 200, 200, 404, 500][i % 5],
      'service.instance': `inst-${i % 8}`,
    });
  }
  return out;
}

async function runWorkload(records, collectEvery, attrs) {
  const reader = new TestMetricReader({
    aggregationSelector(type) {
      return type === InstrumentType.HISTOGRAM
        ? { type: AggregationType.EXPONENTIAL_HISTOGRAM }
        : { type: AggregationType.DEFAULT };
    },
  });
  const provider = new MeterProvider({ readers: [reader] });
  const hist = provider.getMeter('bench').createHistogram('latency');
  const nAttrs = attrs.length;

  // checksum forces the collected output to be observed (defeats DCE).
  let checksum = 0;
  for (let i = 0; i < records; i++) {
    hist.record(lognormal[i % SIZE], attrs[i % nAttrs]);
    if ((i + 1) % collectEvery === 0) {
      const { resourceMetrics } = await reader.collect();
      checksum += resourceMetrics.scopeMetrics[0].metrics[0].dataPoints.length;
    }
  }
  await provider.shutdown();
  return checksum;
}

async function measure(label, records, collectEvery, attrs) {
  await runWorkload(200_000, collectEvery, attrs); // warmup
  const runs = [];
  for (let r = 0; r < 5; r++) {
    const t0 = performance.now();
    const cs = await runWorkload(records, collectEvery, attrs);
    const t1 = performance.now();
    runs.push(records / ((t1 - t0) / 1000));
    if (cs < 0) console.log(cs); // keep checksum live
  }
  runs.sort((a, b) => a - b);
  const median = Math.round(runs[2]);
  const all = runs.map(x => Math.round(x)).join(', ');
  console.log(`${label}: ${median.toLocaleString()} records/sec (median of 5) [${all}]`);
}

(async () => {
  const RECORDS = 2_000_000;
  const COLLECT_EVERY = 100_000; // ~20 collections per run
  await measure(
    '1 attr set   (mapToIndex-dominated)',
    RECORDS,
    COLLECT_EVERY,
    makeAttrs(1)
  );
  await measure(
    '100 attr sets (realistic cardinality)',
    RECORDS,
    COLLECT_EVERY,
    makeAttrs(100)
  );
})();
