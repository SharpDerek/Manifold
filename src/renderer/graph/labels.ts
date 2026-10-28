import { PerspectiveCamera } from 'three';
import type { Camera, Sprite, Vector3 } from 'three';

export const labelPixels = { width: 180, height: 28, gap: 6 };

// Sprite remains at the exact node position. Offset its billboard quad in screen
// space instead of moving its anchor along world Y (which drifts during orbit).
export function positionNodeLabel(
  sprite: Sprite,
  camera: Camera,
  width: number,
  height: number,
  nodeRadius: number,
  scratch: Vector3,
) {
  const viewportWidth = Math.max(1, width);
  const viewportHeight = Math.max(1, height);
  sprite.scale.set(
    (2 * labelPixels.width) /
      (viewportWidth * Math.abs(camera.projectionMatrix.elements[0]!)),
    (2 * labelPixels.height) /
      (viewportHeight * Math.abs(camera.projectionMatrix.elements[5]!)),
    1,
  );
  scratch.copy(sprite.position).applyMatrix4(camera.matrixWorldInverse);
  const depth =
    camera instanceof PerspectiveCamera ? Math.max(0.001, -scratch.z) : 1;
  const radiusPixels =
    (nodeRadius *
      Math.abs(camera.projectionMatrix.elements[5]!) *
      viewportHeight) /
    (2 * depth);
  sprite.center.set(
    0.5,
    -(radiusPixels + labelPixels.gap) / labelPixels.height,
  );
  sprite.updateMatrixWorld(true);
}
