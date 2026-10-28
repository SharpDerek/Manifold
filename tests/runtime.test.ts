import { describe, expect, it } from 'vitest';
import {
  runtimeRequestSchema,
  runtimeResponseSchema,
} from '../src/contracts/runtime';

describe('runtime IPC contracts', () => {
  it('rejects unsupported versions and unexpected renderer payloads', () => {
    expect(runtimeRequestSchema.safeParse({ schemaVersion: 2 }).success).toBe(
      false,
    );
    expect(
      runtimeRequestSchema.safeParse({ schemaVersion: 1, path: 'arbitrary' })
        .success,
    ).toBe(false);
  });
  it('accepts only declared worker states', () => {
    expect(
      runtimeResponseSchema.safeParse({ schemaVersion: 1, worker: 'ready' })
        .success,
    ).toBe(true);
    expect(
      runtimeResponseSchema.safeParse({ schemaVersion: 1, worker: 'invented' })
        .success,
    ).toBe(false);
  });
});
