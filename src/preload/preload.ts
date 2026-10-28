import { contextBridge, ipcRenderer } from 'electron';
import { runtimeChannel, runtimeResponseSchema } from '../contracts/runtime';
import type { ManifoldApi } from '../contracts/runtime';

const api: ManifoldApi = {
  async getRuntimeStatus() {
    return runtimeResponseSchema.parse(
      await ipcRenderer.invoke(runtimeChannel, { schemaVersion: 1 }),
    );
  },
};

contextBridge.exposeInMainWorld('manifold', Object.freeze(api));
