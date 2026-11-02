import { afterEach, describe, expect, it } from 'vitest';
import { assertTestDatabaseUrl } from '../../scripts/test-database-url.mjs';

const ENV_NAME = 'FOUNDATION_TEST_DATABASE_URL';
const originalValue = process.env[ENV_NAME];

afterEach(() => {
  if (originalValue === undefined) {
    delete process.env[ENV_NAME];
  } else {
    process.env[ENV_NAME] = originalValue;
  }
});

describe('assertTestDatabaseUrl', () => {
  it('rejects a missing environment variable', () => {
    delete process.env[ENV_NAME];

    expect(() => assertTestDatabaseUrl(ENV_NAME)).toThrow(
      `${ENV_NAME} is not defined`,
    );
  });

  it('rejects an invalid URL', () => {
    process.env[ENV_NAME] = 'not-a-url';

    expect(() => assertTestDatabaseUrl(ENV_NAME)).toThrow(
      'is not a valid database URL',
    );
  });

  it('rejects a non-PostgreSQL URL', () => {
    process.env[ENV_NAME] = 'https://localhost/transcendence_test';

    expect(() => assertTestDatabaseUrl(ENV_NAME)).toThrow(
      'must use the PostgreSQL protocol',
    );
  });

  it('rejects a URL without a database name', () => {
    process.env[ENV_NAME] = 'postgresql://test:test@localhost:5432/';

    expect(() => assertTestDatabaseUrl(ENV_NAME)).toThrow(
      'does not include a database name',
    );
  });

  it('rejects the development database', () => {
    process.env[ENV_NAME] =
      'postgresql://test:test@localhost:5432/transcendence';

    expect(() => assertTestDatabaseUrl(ENV_NAME)).toThrow(
      'must point to a dedicated test database',
    );
  });

  it('accepts a dedicated test database', () => {
    const connectionString =
      'postgresql://test:test@localhost:5432/transcendence_test';

    process.env[ENV_NAME] = connectionString;

    expect(assertTestDatabaseUrl(ENV_NAME)).toEqual({
      connectionString,
      databaseName: 'transcendence_test',
    });
  });
});
