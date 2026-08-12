/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

const Benchmark = require('benchmark');
const {
  getMapping,
} = require('../../../build/src/aggregator/exponential-histogram/mapping/getMapping.js');
const {
  ExponentialHistogramAccumulation,
} = require('../../../build/src/aggregator/ExponentialHistogram.js');
const { lognormal, wideRange, SIZE } = require('./workload.js');

const log20 = getMapping(20); // default scale, LogarithmMapping hot path
const exp0 = getMapping(0); // ExponentMapping
const expNeg4 = getMapping(-4); // ExponentMapping with a shift

const suite = new Benchmark.Suite();
suite.on('cycle', event => {
  console.log(String(event.target));
});

// `sink` defeats dead-code elimination of the mapping results.
let sink = 0;

suite.add(`LogarithmMapping(20).mapToIndex x${SIZE} (lognormal)`, () => {
  for (let i = 0; i < SIZE; i++) sink += log20.mapToIndex(lognormal[i]);
});

suite.add(`ExponentMapping(0).mapToIndex x${SIZE} (wide range)`, () => {
  for (let i = 0; i < SIZE; i++) sink += exp0.mapToIndex(wideRange[i]);
});

suite.add(`ExponentMapping(-4).mapToIndex x${SIZE} (wide range)`, () => {
  for (let i = 0; i < SIZE; i++) sink += expNeg4.mapToIndex(wideRange[i]);
});

suite.add(`record() x${SIZE} (lognormal, fresh accumulation)`, () => {
  const acc = new ExponentialHistogramAccumulation([0, 0], 160, true);
  for (let i = 0; i < SIZE; i++) acc.record(lognormal[i]);
  sink += acc.count;
});

suite.add(`record() x${SIZE} (wide range, fresh accumulation)`, () => {
  const acc = new ExponentialHistogramAccumulation([0, 0], 160, true);
  for (let i = 0; i < SIZE; i++) acc.record(wideRange[i]);
  sink += acc.count;
});

suite.on('complete', () => {
  if (sink === Infinity) console.log('sink', sink);
});

suite.run();
