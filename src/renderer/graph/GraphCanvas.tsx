import { Component, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  CanvasTexture,
  Color,
  InstancedMesh,
  Object3D,
  PerspectiveCamera,
  Vector3,
  Sprite,
} from 'three';
import { positionNodeLabel } from './labels';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type {
  SceneProjection,
  VisibleNode,
  Position,
} from '../layout/hierarchy';

type Props = {
  projection: SceneProjection;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onFocus: (id: string) => void;
  focus: { id: string; nonce: number } | null;
  reset: number;
};

// Panel interactions must not reapply the initial camera configuration.
const initialCamera = {
  position: [15, 12, 30] as [number, number, number],
  fov: 50,
  near: 0.1,
  far: 100000,
};

class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; message: string }
> {
  state = { failed: false, message: '' };
  static getDerivedStateFromError(error: unknown) {
    return {
      failed: true,
      message:
        error instanceof Error ? error.stack || error.message : String(error),
    };
  }
  render() {
    return this.state.failed ? (
      <div className="error" role="alert">
        <p>
          3D rendering is unavailable. Use the directory list and details below.
        </p>
        <button onClick={() => window.location.reload()}>Reload view</button>
        <details>
          <summary>Rendering error details</summary>
          <pre>{this.state.message}</pre>
        </details>
      </div>
    ) : (
      this.props.children
    );
  }
}

function Instances({
  kind,
  nodes,
  selectedId,
  onSelect,
  onFocus,
}: {
  kind: 'directory' | 'file' | 'symlink';
  nodes: VisibleNode[];
  selectedId: string | null;
  onSelect: Props['onSelect'];
  onFocus: Props['onFocus'];
}) {
  const mesh = useRef<InstancedMesh>(null);
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const transform = new Object3D();
    nodes.forEach((item, index) => {
      transform.position.set(...item.position);
      transform.scale.setScalar(item.node.id === selectedId ? 1.4 : 1);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(index, transform.matrix);
      mesh.current!.setColorAt(
        index,
        new Color(
          item.node.id === selectedId
            ? '#ffffff'
            : kind === 'directory'
              ? '#61c6ed'
              : kind === 'file'
                ? '#c8d2e5'
                : '#e9b66b',
        ),
      );
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
    invalidate();
  }, [nodes, selectedId, kind, invalidate]);
  function choose(event: ThreeEvent<MouseEvent>, focus = false) {
    event.stopPropagation();
    if (event.delta > 4 || event.instanceId === undefined) return;
    const item = nodes[event.instanceId];
    if (item) {
      onSelect(item.node.id);
      if (focus) onFocus(item.node.id);
    }
  }
  if (!nodes.length) return null;
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, nodes.length]}
      onClick={(event) => choose(event)}
      onDoubleClick={(event) => choose(event, true)}
    >
      {kind === 'directory' ? (
        <boxGeometry args={[1.4, 1.1, 1.1]} />
      ) : kind === 'file' ? (
        <sphereGeometry args={[0.55, 12, 8]} />
      ) : (
        <octahedronGeometry args={[0.75]} />
      )}
      <meshStandardMaterial roughness={0.6} metalness={0.1} />
    </instancedMesh>
  );
}

function Edges({ projection }: { projection: SceneProjection }) {
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute(
      'position',
      new Float32BufferAttribute(
        projection.edges.flatMap((edge) => [...edge.source, ...edge.target]),
        3,
      ),
    );
    return result;
  }, [projection]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#526980" />
    </lineSegments>
  );
}

function Label({
  nodeId,
  kind,
  text,
  position,
  selected,
}: {
  nodeId: string;
  kind: 'directory' | 'file' | 'symlink';
  text: string;
  position: Position;
  selected: boolean;
}) {
  const sprite = useRef<Sprite>(null);
  const scratch = useMemo(() => new Vector3(), []);
  const { size } = useThree();
  const radius =
    (kind === 'directory' ? 1.05 : kind === 'file' ? 0.55 : 0.75) *
    (selected ? 1.4 : 1);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 72;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#10151ee8';
    context.fillRect(0, 0, 512, 72);
    context.font = '40px Segoe UI, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = selected ? '#ffffff' : '#c2d5e7';
    const short = text.length > 32 ? `${text.slice(0, 31)}…` : text;
    context.fillText(short, 256, 36, 492);
    return new CanvasTexture(canvas);
  }, [text, selected]);
  useEffect(() => {
    texture.needsUpdate = true;
    return () => texture.dispose();
  }, [texture]);
  return (
    <sprite
      ref={sprite}
      name={`label:${nodeId}`}
      position={position}
      frustumCulled={false}
      onBeforeRender={(_renderer, _scene, camera) => {
        if (sprite.current)
          positionNodeLabel(
            sprite.current,
            camera,
            size.width,
            size.height,
            radius,
            scratch,
          );
      }}
      renderOrder={1}
    >
      <spriteMaterial
        map={texture}
        transparent
        sizeAttenuation={false}
        depthTest={false}
      />
    </sprite>
  );
}

function CameraControls({
  projection,
  focus,
  reset,
}: Pick<Props, 'projection' | 'focus' | 'reset'>) {
  const { camera, gl, invalidate, size } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const last = useRef({ reset: -1, focus: -1 });
  useEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    orbit.minDistance = 2;
    orbit.enableDamping = false;
    // Keyboard events are scoped to the canvas so inputs and lists keep their keys.
    orbit.listenToKeyEvents(gl.domElement);
    const changed = () => invalidate();
    orbit.addEventListener('change', changed);
    controls.current = orbit;
    return () => {
      orbit.removeEventListener('change', changed);
      orbit.dispose();
      controls.current = null;
      last.current = { reset: -1, focus: -1 };
    };
  }, [camera, gl, invalidate]);
  useEffect(() => {
    if (!controls.current || !(camera instanceof PerspectiveCamera)) return;
    const resetting = last.current.reset !== reset;
    const focusing = focus && last.current.focus !== focus.nonce;
    if (!resetting && !focusing) return;
    let target = new Vector3();
    let distance = 16;
    if (!resetting && focus) {
      const selected = projection.nodes.find(
        (item) => item.node.id === focus.id,
      );
      if (!selected) return;
      target = new Vector3(...selected.position);
    } else {
      const min = new Vector3(Infinity, Infinity, Infinity);
      const max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const item of projection.nodes) {
        const p = new Vector3(...item.position);
        min.min(p);
        max.max(p);
      }
      if (projection.nodes.length) {
        target = min.clone().add(max).multiplyScalar(0.5);
        const radius = Math.max(4, min.distanceTo(max) / 2 + 2);
        const vertical = (camera.fov * Math.PI) / 360;
        const horizontal = Math.atan(
          (Math.tan(vertical) * size.width) / Math.max(1, size.height),
        );
        distance = (radius / Math.sin(Math.min(vertical, horizontal))) * 1.15;
      }
    }
    const direction = camera.position
      .clone()
      .sub(controls.current.target)
      .normalize();
    if (direction.lengthSq() === 0 || resetting)
      direction.set(0.5, 0.35, 1).normalize();
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.far = Math.max(
      10000,
      distance * 10,
      ...projection.nodes.map(
        (item) => new Vector3(...item.position).distanceTo(target) * 4,
      ),
    );
    camera.updateProjectionMatrix();
    controls.current.target.copy(target);
    controls.current.update();
    invalidate();
    last.current = { reset, focus: focus?.nonce ?? -1 };
  }, [projection, focus, reset, camera, size, invalidate]);
  return null;
}

export function Scene(props: Props) {
  const groups = useMemo(
    () => ({
      directory: props.projection.nodes.filter(
        (item) => item.node.entry.kind === 'directory',
      ),
      file: props.projection.nodes.filter(
        (item) => item.node.entry.kind === 'file',
      ),
      symlink: props.projection.nodes.filter(
        (item) => item.node.entry.kind === 'symlink',
      ),
    }),
    [props.projection],
  );
  const labels = useMemo(() => {
    const selected = props.projection.nodes.find(
      (item) => item.node.id === props.selectedId,
    );
    return [
      ...(selected ? [selected] : []),
      ...props.projection.nodes.filter(
        (item) => item.node.id !== props.selectedId,
      ),
    ].slice(0, 40);
  }, [props.projection, props.selectedId]);
  return (
    <>
      <color attach="background" args={['#0d1420']} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[20, 40, 30]} intensity={2} />
      <Edges projection={props.projection} />
      {(['directory', 'file', 'symlink'] as const).map((kind) => (
        <Instances
          key={kind}
          kind={kind}
          nodes={groups[kind]}
          selectedId={props.selectedId}
          onSelect={props.onSelect}
          onFocus={props.onFocus}
        />
      ))}
      {labels.map((item) => (
        <Label
          key={item.node.id}
          nodeId={item.node.id}
          kind={item.node.entry.kind}
          text={item.node.entry.name}
          position={item.position}
          selected={item.node.id === props.selectedId}
        />
      ))}
      <CameraControls {...props} />
    </>
  );
}

export function GraphCanvas(props: Props) {
  return (
    <SceneBoundary>
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={initialCamera}
        onCreated={({ gl }) => {
          gl.domElement.tabIndex = 0;
          gl.domElement.dataset.graphReady = 'true';
          gl.domElement.setAttribute(
            'aria-label',
            '3D directory graph. Drag to orbit, right-drag to pan, scroll to zoom.',
          );
        }}
        onPointerMissed={() => props.onSelect(null)}
        fallback={
          <p role="alert">
            WebGL is unavailable. Use the directory list below.
          </p>
        }
      >
        <Scene {...props} />
      </Canvas>
    </SceneBoundary>
  );
}
