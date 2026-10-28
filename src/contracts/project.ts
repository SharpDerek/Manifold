import { z } from 'zod';
import type { ProjectState } from '../core/graph';

const resource = z.strictObject({ namespace: z.string(), key: z.string() });
const provenance = z.strictObject({
  provider: z.string(),
  version: z.string(),
  configuration: z.string(),
  inputRevision: z.string(),
});
const entry = z.strictObject({
  resource,
  relativePath: z.string(),
  name: z.string(),
  kind: z.enum(['directory', 'file', 'symlink']),
  size: z.number().nonnegative().finite(),
  modifiedMs: z.number().finite(),
  revision: z.string(),
});
export const policySchema = z.strictObject({
  excludedDirectoryNames: z
    .array(
      z
        .string()
        .min(1)
        .max(255)
        .refine(
          (name) => !/[\\/\u0000]/.test(name) && name !== '.' && name !== '..',
        ),
    )
    .max(100),
});
export const snapshotSchema = z.strictObject({
  sessionId: z.string(),
  revision: z.number().int().positive(),
  root: resource,
  nodes: z.array(z.strictObject({ id: z.string(), entry, provenance })),
  edges: z.array(
    z.strictObject({
      id: z.string(),
      kind: z.literal('contains'),
      source: z.string(),
      target: z.string(),
      provenance,
    }),
  ),
  diagnostics: z.array(
    z.strictObject({
      severity: z.enum(['warning', 'error']),
      code: z.string(),
      message: z.string(),
      resource: resource.nullable(),
    }),
  ),
  coverage: z.enum(['complete', 'incomplete']),
});
export const projectStateSchema = z.strictObject({
  version: z.number().int().nonnegative(),
  sessionId: z.string().nullable(),
  rootPath: z.string().nullable(),
  status: z.enum(['empty', 'scanning', 'scanned', 'incomplete', 'failed']),
  discovered: z.number().int().nonnegative(),
  policy: policySchema,
  snapshot: snapshotSchema.nullable(),
  error: z.string().nullable(),
});
export const projectChannel = 'manifold:project';
export const projectRequestSchema = z.discriminatedUnion('command', [
  z.strictObject({
    schemaVersion: z.literal(1),
    command: z.literal('state'),
    knownVersion: z.number().int().min(-1),
  }),
  z.strictObject({ schemaVersion: z.literal(1), command: z.literal('open') }),
  z.strictObject({ schemaVersion: z.literal(1), command: z.literal('close') }),
  z.strictObject({
    schemaVersion: z.literal(1),
    command: z.literal('refresh'),
    policy: policySchema,
  }),
]);
export const projectResponseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  state: projectStateSchema.nullable(),
});
export type ProjectRequest = z.infer<typeof projectRequestSchema>;
export interface ProjectApi {
  project(request: ProjectRequest): Promise<ProjectState | null>;
}

export const scanRequestSchema = z.strictObject({
  sessionId: z.string(),
  rootPath: z.string(),
  policy: policySchema,
});
export const workerCommandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('scan'),
    schemaVersion: z.literal(1),
    request: scanRequestSchema,
  }),
  z.strictObject({
    type: z.literal('cancel'),
    schemaVersion: z.literal(1),
    sessionId: z.string(),
  }),
]);
export const workerEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('progress'),
    schemaVersion: z.literal(1),
    sessionId: z.string(),
    discovered: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('snapshot'),
    schemaVersion: z.literal(1),
    sessionId: z.string(),
    snapshot: snapshotSchema,
  }),
  z.strictObject({
    type: z.literal('failed'),
    schemaVersion: z.literal(1),
    sessionId: z.string(),
    message: z.string(),
  }),
]);
