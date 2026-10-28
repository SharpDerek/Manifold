import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { createRoot, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { GraphCanvas, Scene } from '../src/renderer/graph/GraphCanvas';
import type { SceneProjection } from '../src/renderer/layout/hierarchy';

afterEach(() => vi.unstubAllGlobals());

it('mounts the Canvas bridge under the React DOM renderer without invalid hooks', () => {
  expect(() =>
    renderToString(
      createElement(GraphCanvas, {
        projection: {
          nodes: [],
          edges: [],
          indexedCount: 0,
          hiddenCount: 0,
          limitReached: false,
        },
        selectedId: null,
        onSelect() {},
        onFocus() {},
        focus: null,
        reset: 0,
      }),
    ),
  ).not.toThrow();
});

it('mounts and changes selection in the real scene, including empty kind groups', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  const document = {
    addEventListener() {},
    removeEventListener() {},
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillRect() {}, fillText() {} }),
    }),
  };
  vi.stubGlobal('document', document);
  const canvas = {
    style: {},
    ownerDocument: document,
    getRootNode: () => document,
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ width: 800, height: 600, top: 0, left: 0 }),
  };
  const renderer = {
    domElement: canvas,
    render() {},
    setPixelRatio() {},
    setSize() {},
  };
  extend({
    Color: THREE.Color,
    AmbientLight: THREE.AmbientLight,
    DirectionalLight: THREE.DirectionalLight,
    InstancedMesh: THREE.InstancedMesh,
    BoxGeometry: THREE.BoxGeometry,
    SphereGeometry: THREE.SphereGeometry,
    OctahedronGeometry: THREE.OctahedronGeometry,
    MeshStandardMaterial: THREE.MeshStandardMaterial,
    LineSegments: THREE.LineSegments,
    LineBasicMaterial: THREE.LineBasicMaterial,
    Sprite: THREE.Sprite,
    SpriteMaterial: THREE.SpriteMaterial,
  });
  const root = createRoot(canvas as unknown as HTMLCanvasElement);
  await root.configure({
    gl: renderer as unknown as THREE.WebGLRenderer,
    frameloop: 'never',
    dpr: 1,
    size: { width: 800, height: 600, top: 0, left: 0 },
  });
  const provenance = {
    provider: 'directory',
    version: '1',
    configuration: '',
    inputRevision: '1',
  };
  const projection: SceneProjection = {
    nodes: [
      {
        node: {
          id: 'root',
          entry: {
            resource: { namespace: 'test', key: 'root' },
            relativePath: '',
            name: 'root',
            kind: 'directory',
            size: 0,
            modifiedMs: 0,
            revision: '1',
          },
          provenance,
        },
        position: [0, 0, 0],
        childCount: 1,
      },
      {
        node: {
          id: 'child',
          entry: {
            resource: { namespace: 'test', key: 'child' },
            relativePath: 'child',
            name: 'child',
            kind: 'directory',
            size: 0,
            modifiedMs: 0,
            revision: '1',
          },
          provenance,
        },
        position: [0, -6, 0],
        childCount: 0,
      },
    ],
    edges: [{ id: 'edge', source: [0, 0, 0], target: [0, -6, 0] }],
    indexedCount: 2,
    hiddenCount: 0,
    limitReached: false,
  };
  const render = (selectedId: string) =>
    createElement(
      StrictMode,
      null,
      createElement(Scene, {
        projection,
        selectedId,
        onSelect() {},
        onFocus() {},
        focus: null,
        reset: 0,
      }),
    );
  try {
    let store: ReturnType<typeof root.render> | undefined;
    await act(async () => {
      store = root.render(render('root'));
    });
    expect(
      store!
        .getState()
        .scene.children.some((child) => child instanceof THREE.InstancedMesh),
    ).toBe(true);
    await act(async () => {
      root.render(render('child'));
    });
    expect(
      store!
        .getState()
        .scene.children.filter((child) => child instanceof THREE.InstancedMesh),
    ).toHaveLength(1);
  } finally {
    await act(async () => {
      root.unmount();
    });
  }
});
