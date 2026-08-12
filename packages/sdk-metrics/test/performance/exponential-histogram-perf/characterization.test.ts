/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */
import { getMapping } from '../../../src/aggregator/exponential-histogram/mapping/getMapping';
import * as assert from 'assert';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { scales, values } = require('./corpus.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('./fixture.json');

// Behavior lock for the exponential-histogram mappings. The fixture is a frozen
// snapshot of mapToIndex/lowerBoundary over a broad value corpus, generated from
// the baseline. Any perf refactor that changes an output fails here. Regenerate
// (generate-fixture.js) only for an intentional, reviewed behavior change.
describe('exponential histogram mapping characterization', () => {
  function s(n: number): string {
    return Object.is(n, -0) ? '-0' : String(n);
  }

  it('reproduces the frozen fixture', () => {
    let i = 0;
    for (const scale of scales) {
      const mapping = getMapping(scale);
      for (const value of values) {
        let index: number | 'ERR';
        try {
          index = mapping.mapToIndex(value);
        } catch {
          index = 'ERR';
        }
        let lowerBoundary: string;
        try {
          lowerBoundary = index === 'ERR' ? 'ERR' : s(mapping.lowerBoundary(index));
        } catch {
          lowerBoundary = 'ERR';
        }

        const expected = fixture[i++];
        const where = `value=${s(value)} scale=${scale}`;
        assert.strictEqual(scale, expected.scale, `scale alignment at ${where}`);
        assert.strictEqual(index, expected.index, `mapToIndex ${where}`);
        assert.strictEqual(lowerBoundary, expected.lowerBoundary, `lowerBoundary ${where}`);
      }
    }
    assert.strictEqual(i, fixture.length, 'corpus size matches fixture');
  });
});
