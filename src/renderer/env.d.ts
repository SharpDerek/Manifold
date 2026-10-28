import type { ManifoldApi } from '../contracts/runtime';

declare global {
  interface Window {
    readonly manifold: ManifoldApi;
  }
}
