# Exponential histogram mapping — perf measurement harness

Measurement tooling for a series of behavior-preserving perf refactors to the
exponential histogram mappings (`src/aggregator/exponential-histogram/`). This tree is a
**branch-only measurement tool** — it is not intended to merge upstream. The before/after
numbers it produces go in the PR description; only the product change (plus a few targeted
unit-test cases) is meant to merge.

One `git rm -r` removes the whole harness.

## Contents

- `workload.js` — seeded, deterministic value sets (lognormal latency-like; wide dynamic range).
- `throughput.bench.js` — `benchmark.js` ops/sec for `mapToIndex` (both mappings) and `record()` in
  isolation. Use it to attribute a change and iterate; the micro numbers overstate real-world impact.
- `macro.js` — full-pipeline benchmark: records through the public `Histogram.record()` API into an
  exponential-histogram aggregation with periodic `collect()`. Reports production-representative
  throughput (records/sec), the honest number, since the mapping is diluted by attribute processing,
  storage, and export.
- `gc.js` — GC/allocation probe (counts GC events over a fixed workload).
- `corpus.js` — value × scale corpus that exercises every mapping branch.
- `generate-fixture.js` — regenerates `fixture.json` from the compiled mappings.
- `fixture.json` — frozen behavior snapshot (the baseline).
- `characterization.test.ts` — asserts current code reproduces `fixture.json`. Picked up by
  the normal mocha run (`test/**/*.test.ts`); it is the behavior lock across increments.

## Running

```sh
# from packages/sdk-metrics
npm run compile                                                   # benches require build/src
node test/performance/exponential-histogram-perf/throughput.bench.js   # isolated mapToIndex + record()
node test/performance/exponential-histogram-perf/macro.js              # full pipeline, records/sec
node --expose-gc test/performance/exponential-histogram-perf/gc.js
npx mocha test/performance/exponential-histogram-perf/characterization.test.ts
```

## Method

- Compare with **git-branch checkouts** (baseline commit vs increment commit).
- **Interleave** baseline/increment runs (~5x) and report the median — run-to-run variance
  on the reference machine is ~2%, so treat sub-3% deltas as noise.
- `generate-fixture.js` is run only on the baseline. If an increment changes a fixture
  output, that is a behavior change and must be reviewed, not silently regenerated.
