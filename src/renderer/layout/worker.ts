import { snapshotSchema } from '../../contracts/project';
import { projectHierarchy } from './hierarchy';

self.onmessage = (event: MessageEvent<unknown>) => {
  const value = event.data;
  if (
    !value ||
    typeof value !== 'object' ||
    !('requestId' in value) ||
    typeof value.requestId !== 'number'
  )
    return;
  try {
    if (
      !('snapshot' in value) ||
      !('expanded' in value) ||
      !Array.isArray(value.expanded) ||
      !value.expanded.every((id) => typeof id === 'string') ||
      !('limit' in value) ||
      typeof value.limit !== 'number'
    )
      throw new Error('Invalid layout request');
    const snapshot = snapshotSchema.parse(value.snapshot);
    self.postMessage({
      requestId: value.requestId,
      projection: projectHierarchy(
        snapshot,
        new Set(value.expanded),
        value.limit,
      ),
    });
  } catch (error) {
    self.postMessage({
      requestId: value.requestId,
      error: error instanceof Error ? error.message : 'Layout failed.',
    });
  }
};
