import { z } from 'zod';
import type { ProjectApi } from './project';

export const runtimeChannel = 'manifold:runtime-status';
export const runtimeRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
});
export const runtimeResponseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  worker: z.enum(['starting', 'ready', 'failed']),
});
export const workerReadySchema = z.strictObject({
  type: z.literal('ready'),
  schemaVersion: z.literal(1),
});

export type RuntimeResponse = z.infer<typeof runtimeResponseSchema>;
export interface ManifoldApi extends ProjectApi {
  getRuntimeStatus(): Promise<RuntimeResponse>;
}
