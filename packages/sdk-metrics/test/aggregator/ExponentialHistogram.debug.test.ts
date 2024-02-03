/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ExponentialHistogramAccumulation,
} from '../../src/aggregator/ExponentialHistogram';
import * as assert from 'assert';

describe('debug', () => {
  it.only('attempts to repro', () => {
    const delta = new ExponentialHistogramAccumulation([0, 0], 160);
    delta.updateByIncrement(0.000979, 2); // Bucket: [0.00097656, 0.0010198], Count: 2, Index: -160
    delta.updateByIncrement(0.001959, 2); // Bucket: [0.00195313, 0.0020396], Count: 2, Index: -144
    delta.updateByIncrement(0.002889, 2); // Bucket: [0.00288443, 0.00301213], Count: 2, Index: -135
    delta.updateByIncrement(0.003909, 1); // Bucket: [0.00390625, 0.00407919], Count: 1, Index: -128
    delta.updateByIncrement(0.004859, 1); // Bucket: [0.00485101, 0.00506578], Count: 1, Index: -123
    delta.updateByIncrement(0.005769, 1); // Bucket: [0.00576885, 0.00602426], Count: 1, Index: -119
    delta.updateByIncrement(0.007819, 1); // Bucket: [0.0078125, 0.00815839], Count: 1, Index: -112
    delta.updateByIncrement(0.119709, 1); // Bucket: [0.11970041, 0.125], Count: 1, Index: -49

    console.log('delta');
    delta.printBuckets();

    const previous = new ExponentialHistogramAccumulation([0, 0], 160);
    previous.updateByIncrement(0, 1);
    previous.updateByIncrement(0.000979, 29); // Bucket: [0.00097656, 0.00106495], Count: 29, Index: -80
    previous.updateByIncrement(0.001959, 14); // Bucket: [0.00195313, 0.0021299], Count: 14, Index: -72
    previous.updateByIncrement(0.002769, 10); // Bucket: [0.00276214, 0.00301213], Count: 10, Index: -68
    previous.updateByIncrement(0.003909, 2);  // Bucket: [0.00390625, 0.0042598], Count: 2, Index: -64
    previous.updateByIncrement(0.004649, 3);  // Bucket: [0.00464534, 0.00506578], Count: 3, Index: -62
    previous.updateByIncrement(0.006569, 1);  // Bucket: [0.0065695, 0.00716409], Count: 1, Index: -58
    previous.updateByIncrement(0.007819, 2);  // Bucket: [0.0078125, 0.00851959], Count: 2, Index: -56
    previous.updateByIncrement(0.011049, 1);  // Bucket: [0.01104854, 0.01204852], Count: 1, Index: -52
    previous.updateByIncrement(0.018589, 3);  // Bucket: [0.01858136, 0.02026312], Count: 3, Index: -46
    previous.updateByIncrement(0.020269, 5);  // Bucket: [0.02026312, 0.02209709], Count: 5, Index: -45
    previous.updateByIncrement(0.028659, 2);  // Bucket: [0.02865638, 0.03125], Count: 2, Index: -41
    previous.updateByIncrement(0.037169, 2);  // Bucket: [0.03716272, 0.04052624], Count: 2, Index: -38
    previous.updateByIncrement(0.040529, 1);  // Bucket: [0.04052624, 0.04419417], Count: 1, Index: -37
    previous.updateByIncrement(0.044199, 1);  // Bucket: [0.04419417, 0.04819409], Count: 1, Index: -36
    previous.updateByIncrement(0.048199, 1);  // Bucket: [0.04819409, 0.05255603], Count: 1, Index: -35
    previous.updateByIncrement(0.052559, 2);  // Bucket: [0.05255603, 0.05731275], Count: 2, Index: -34
    previous.updateByIncrement(0.057319, 1);  // Bucket: [0.05731275, 0.0625], Count: 1, Index: -33
    previous.updateByIncrement(0.068159, 2);  // Bucket: [0.06815673, 0.07432544], Count: 2, Index: -31
    previous.updateByIncrement(0.074329, 1);  // Bucket: [0.07432544, 0.08105247], Count: 1, Index: -30
    previous.updateByIncrement(0.105119, 1);  // Bucket: [0.10511205, 0.11462551], Count: 1, Index: -26
    previous.updateByIncrement(0.192779, 1);  // Bucket: [0.19277635, 0.2102241], Count: 1, Index: -19
    previous.updateByIncrement(1.010000, 9);  // Bucket: [1, 1.09050773], Count: 9, Index: 0

    console.log('previous');
    previous.printBuckets();

    const result = delta.clone();
    result.merge(previous);

    console.log('result')
    result.printBuckets();

    assert.equal(result.count, delta.count + previous.count);
    assert.equal(result.count, bucketCounts(result));
    assert.equal(delta.count, bucketCounts(delta));
    assert.equal(previous.count, bucketCounts(previous));
    assert.equal(bucketCounts(result), bucketCounts(delta) + bucketCounts(previous));
  })
});

function bucketCounts(histo: ExponentialHistogramAccumulation): number {
  // zero counts do not get a dedicated bucket, but they are part of the overall
  // histogram count
  return histo.toPointValue().positive.bucketCounts.reduce(
    (total, current) => total += current,
    histo.zeroCount
  );
}
