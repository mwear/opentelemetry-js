/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as assert from 'assert';
import {
  isWrapped,
  readDeclarativeConfig,
  safeExecuteInTheMiddle,
  safeExecuteInTheMiddleAsync,
} from '../../src';
import type { ConfigProvider } from '@opentelemetry/api-config';

describe('isWrapped', function () {
  describe('when function is wrapped', function () {
    it('should return true', function () {
      const obj: any = {
        wrapMe: function () {},
      };
      obj.wrapMe.__original = function () {};
      obj.wrapMe.__unwrap = function () {};
      obj.wrapMe.__wrapped = true;

      assert.deepStrictEqual(isWrapped(obj.wrapMe), true);
    });
  });
  describe('when function is NOT wrapped', function () {
    it('should return false', function () {
      const obj: any = {
        wrapMe: function () {},
      };
      obj.wrapMe.__unwrap = function () {};
      obj.wrapMe.__wrapped = true;

      assert.deepStrictEqual(isWrapped(obj.wrapMe), false);
    });
  });
});

describe('safeExecuteInTheMiddle', function () {
  it('should not throw error', function () {
    safeExecuteInTheMiddle(
      () => {
        return 'foo';
      },
      err => {
        assert.deepStrictEqual(err, undefined);
      },
      true
    );
  });
  it('should throw error', function () {
    const error = new Error('test');
    try {
      safeExecuteInTheMiddle(
        () => {
          throw error;
        },
        err => {
          assert.deepStrictEqual(error, err);
        }
      );
    } catch (err) {
      assert.deepStrictEqual(error, err);
    }
  });
  it('should return result', function () {
    const result = safeExecuteInTheMiddle(
      () => {
        return 1;
      },
      (err, result) => {
        assert.deepStrictEqual(err, undefined);
        assert.deepStrictEqual(result, 1);
      }
    );
    assert.deepStrictEqual(result, 1);
  });
});

describe('safeExecuteInTheMiddleAsync', function () {
  it('should not throw error', function (done) {
    safeExecuteInTheMiddleAsync(
      async () => {
        await new Promise(res => setTimeout(res, 1));
        return 'foo';
      },
      err => {
        assert.deepStrictEqual(err, undefined);
        done();
      },
      true
    );
  });
  it('should throw error', async function () {
    const error = new Error('test');
    try {
      await safeExecuteInTheMiddleAsync(
        async () => {
          await new Promise(res => setTimeout(res, 1));
          throw error;
        },
        err => {
          assert.deepStrictEqual(error, err);
        }
      );
    } catch (err) {
      assert.deepStrictEqual(error, err);
    }
  });
  it('should return result', async function () {
    const result = await safeExecuteInTheMiddleAsync(
      async () => {
        await new Promise(res => setTimeout(res, 1));
        return 1;
      },
      (err, result) => {
        assert.deepStrictEqual(err, undefined);
        assert.deepStrictEqual(result, 1);
      }
    );
    assert.deepStrictEqual(result, 1);
  });
  it('should wait for the error', async function () {
    const result = await Promise.race([
      safeExecuteInTheMiddleAsync(
        () => 1,
        async () => {
          await new Promise(res => setTimeout(res, 100));
        }
      ),
      new Promise(res => setTimeout(() => res('waited'), 10)),
    ]);

    assert.deepStrictEqual(result, 'waited');
  });
});

describe('readDeclarativeConfig', function () {
  let warnings: string[];
  const diag = {
    verbose: () => {},
    debug: () => {},
    info: () => {},
    warn: (m: string) => warnings.push(m),
    error: () => {},
  };

  interface TestConfig {
    serverName?: string;
    requireParent?: boolean;
    maxLen?: number;
    ports?: number[];
    flags?: boolean[];
    redactedQueryParams?: string[];
    headersToSpanAttributes?: {
      client?: { requestHeaders?: string[]; responseHeaders?: string[] };
      server?: { requestHeaders?: string[]; responseHeaders?: string[] };
    };
  }

  function provider(
    own: Record<string, Record<string, unknown>> = {},
    general: Record<string, unknown> = {}
  ): ConfigProvider {
    return {
      getInstrumentationConfig: (name?: string) =>
        name === undefined ? { js: own, general } : (own[name] ?? {}),
      getGeneralInstrumentationConfig: () => general,
    };
  }

  beforeEach(function () {
    warnings = [];
  });

  it('maps own-block properties onto config fields', function () {
    const config = readDeclarativeConfig<TestConfig>({
      configProvider: provider({
        '@otel/test': { server_name: 'srv', require_parent: true },
      }),
      instrumentationName: '@otel/test',
      diag,
      reader: (own): Partial<TestConfig> => ({
        serverName: own.getString('server_name'),
        requireParent: own.getBoolean('require_parent'),
      }),
    });
    assert.deepStrictEqual(config, { serverName: 'srv', requireParent: true });
    assert.deepStrictEqual(warnings, []);
  });

  it('omits properties absent from the config', function () {
    const config = readDeclarativeConfig<TestConfig>({
      configProvider: provider({ '@otel/test': {} }),
      instrumentationName: '@otel/test',
      diag,
      reader: (own): Partial<TestConfig> => ({
        serverName: own.getString('server_name'),
      }),
    });
    assert.deepStrictEqual(config, {});
    assert.deepStrictEqual(warnings, []);
  });

  it('warns and skips on a type mismatch', function () {
    const config = readDeclarativeConfig<TestConfig>({
      configProvider: provider({ '@otel/test': { server_name: 42 } }),
      instrumentationName: '@otel/test',
      diag,
      reader: (own): Partial<TestConfig> => ({
        serverName: own.getString('server_name'),
      }),
    });
    assert.deepStrictEqual(config, {});
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /expected "string", got "number"/);
  });

  it('reads a dotted path from the general block into a nested field', function () {
    const config = readDeclarativeConfig<TestConfig>({
      configProvider: provider(
        {},
        { http: { client: { request_captured_headers: ['a', 'b'] } } }
      ),
      instrumentationName: '@otel/test',
      generalDomains: ['http'],
      diag,
      reader: (own, general): Partial<TestConfig> => ({
        headersToSpanAttributes: {
          client: {
            requestHeaders: general.getStringArray(
              'http.client.request_captured_headers'
            ),
          },
        },
      }),
    });
    assert.deepStrictEqual(config, {
      headersToSpanAttributes: { client: { requestHeaders: ['a', 'b'] } },
    });
    assert.deepStrictEqual(warnings, []);
  });

  it('warns about own-block properties the reader never read', function () {
    readDeclarativeConfig<TestConfig>({
      configProvider: provider({
        '@otel/test': { server_name: 'srv', typo_key: 1 },
      }),
      instrumentationName: '@otel/test',
      diag,
      reader: (own): Partial<TestConfig> => ({
        serverName: own.getString('server_name'),
      }),
    });
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /unhandled.*typo_key/);
  });

  it('treats an explicit null as unset, without warning', function () {
    const config = readDeclarativeConfig<TestConfig>({
      configProvider: provider({
        '@otel/test': { server_name: null, require_parent: null },
      }),
      instrumentationName: '@otel/test',
      diag,
      reader: (own): Partial<TestConfig> => ({
        serverName: own.getString('server_name'),
        requireParent: own.getBoolean('require_parent'),
      }),
    });
    assert.deepStrictEqual(config, {});
    assert.deepStrictEqual(warnings, []);
  });

  it('does not report general-block properties outside its declared domains', function () {
    readDeclarativeConfig<TestConfig>({
      configProvider: provider(
        {},
        {
          http: { client: { request_captured_headers: ['a'] } },
          db: { statement_sanitizer: true },
        }
      ),
      instrumentationName: '@otel/test',
      generalDomains: ['http'],
      diag,
      reader: (own, general): Partial<TestConfig> => ({
        headersToSpanAttributes: {
          client: {
            requestHeaders: general.getStringArray(
              'http.client.request_captured_headers'
            ),
          },
        },
      }),
    });
    assert.deepStrictEqual(warnings, []);
  });

  it('reports unread properties inside its declared general domains', function () {
    readDeclarativeConfig<TestConfig>({
      configProvider: provider(
        {},
        {
          http: { client: { known_methods: ['GET'] } },
          db: { statement_sanitizer: true },
        }
      ),
      instrumentationName: '@otel/test',
      generalDomains: ['http'],
      diag,
      reader: (): Partial<TestConfig> => ({}),
    });
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /unhandled.*http\.client\.known_methods/);
    assert.doesNotMatch(warnings[0], /statement_sanitizer/);
  });

  it('maps number, number[] and boolean[] properties', function () {
    const config = readDeclarativeConfig<TestConfig>({
      configProvider: provider({
        '@otel/test': { max_len: 128, ports: [80, 443], flags: [true, false] },
      }),
      instrumentationName: '@otel/test',
      diag,
      reader: (own): Partial<TestConfig> => ({
        maxLen: own.getNumber('max_len'),
        ports: own.getNumberArray('ports'),
        flags: own.getBooleanArray('flags'),
      }),
    });
    assert.deepStrictEqual(config, {
      maxLen: 128,
      ports: [80, 443],
      flags: [true, false],
    });
    assert.deepStrictEqual(warnings, []);
  });

  it('rejects NaN for number properties', function () {
    const config = readDeclarativeConfig<TestConfig>({
      configProvider: provider({ '@otel/test': { max_len: NaN } }),
      instrumentationName: '@otel/test',
      diag,
      reader: (own): Partial<TestConfig> => ({
        maxLen: own.getNumber('max_len'),
      }),
    });
    assert.deepStrictEqual(config, {});
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /expected "number", got "number"/);
  });

  it('warns when an array element has the wrong type', function () {
    const config = readDeclarativeConfig<TestConfig>({
      configProvider: provider({
        '@otel/test': { ports: [80, '443'], flags: [true, 1] },
      }),
      instrumentationName: '@otel/test',
      diag,
      reader: (own): Partial<TestConfig> => ({
        ports: own.getNumberArray('ports'),
        flags: own.getBooleanArray('flags'),
      }),
    });
    assert.deepStrictEqual(config, {});
    assert.strictEqual(warnings.length, 2);
    assert.match(warnings[0], /expected array of numbers/);
    assert.match(warnings[1], /expected array of booleans/);
  });

  it('keeps sibling branches of the current config when merging nested fields', function () {
    const config = readDeclarativeConfig<TestConfig>({
      configProvider: provider(
        {},
        { http: { client: { request_captured_headers: ['from-yaml'] } } }
      ),
      instrumentationName: '@otel/test',
      generalDomains: ['http'],
      currentConfig: {
        headersToSpanAttributes: {
          client: { responseHeaders: ['in-code-resp'] },
          server: { requestHeaders: ['in-code-server'] },
        },
      },
      diag,
      reader: (own, general): Partial<TestConfig> => ({
        headersToSpanAttributes: {
          client: {
            requestHeaders: general.getStringArray(
              'http.client.request_captured_headers'
            ),
          },
        },
      }),
    });
    assert.deepStrictEqual(config, {
      headersToSpanAttributes: {
        client: {
          responseHeaders: ['in-code-resp'],
          requestHeaders: ['from-yaml'],
        },
        server: { requestHeaders: ['in-code-server'] },
      },
    });
  });

  it('warns instead of propagating an error thrown by the reader', function () {
    const config = readDeclarativeConfig<TestConfig>({
      configProvider: provider({ '@otel/test': { server_name: 'srv' } }),
      instrumentationName: '@otel/test',
      diag,
      reader: (): Partial<TestConfig> => {
        throw new Error('boom');
      },
    });
    assert.deepStrictEqual(config, {});
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /error reading declarative config.*boom/);
  });
});
