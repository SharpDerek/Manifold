import { contextBridge, ipcRenderer } from 'electron';
import { runtimeChannel, runtimeResponseSchema } from '../contracts/runtime';
import type { ManifoldApi } from '../contracts/runtime';
import {
  projectChannel,
  projectRequestSchema,
  projectResponseSchema,
} from '../contracts/project';

const api: ManifoldApi = {
  async project(request) {
    return projectResponseSchema.parse(
      await ipcRenderer.invoke(
        projectChannel,
        projectRequestSchema.parse(request),
      ),
    ).state;
  },
  async getRuntimeStatus() {
    return runtimeResponseSchema.parse(
      await ipcRenderer.invoke(runtimeChannel, { schemaVersion: 1 }),
    );
  },
};

contextBridge.exposeInMainWorld('manifold', Object.freeze(api));
