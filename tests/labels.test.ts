import { expect, it } from 'vitest';
import { PerspectiveCamera, Sprite, SpriteMaterial, Vector3 } from 'three';
import { labelPixels, positionNodeLabel } from '../src/renderer/graph/labels';

it('keeps labels anchored to volumetric nodes with a stable pixel gap and size during orbit and zoom', () => {
  const node = new Vector3(18, -11, 24);
  const sprite = new Sprite(new SpriteMaterial({ sizeAttenuation: false }));
  sprite.position.copy(node);
  const radius = 1.47;
  for (const [width, height] of [
    [1280, 820],
    [800, 600],
    [1920, 1080],
  ]) {
    for (const offset of [
      new Vector3(15, 12, 30),
      new Vector3(-40, 35, -20),
      new Vector3(1, 60, 1),
      new Vector3(100, -20, 50),
    ]) {
      for (const zoom of [1, 2]) {
        const camera = new PerspectiveCamera(50, width! / height!, 0.1, 10000);
        camera.position.copy(node).add(offset);
        camera.lookAt(node);
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        positionNodeLabel(
          sprite,
          camera,
          width!,
          height!,
          radius,
          new Vector3(),
        );
        expect(sprite.position.toArray()).toEqual(node.toArray());
        const view = node.clone().applyMatrix4(camera.matrixWorldInverse);
        // Follow Three's non-attenuated sprite shader: scale by camera depth,
        // shift the billboard quad by center, then project to viewport pixels.
        const project = (x: number, y: number) => {
          const point = view.clone();
          point.x += x * sprite.scale.x * -view.z;
          point.y += y * sprite.scale.y * -view.z;
          point.applyMatrix4(camera.projectionMatrix);
          return [((point.x + 1) * width!) / 2, ((point.y + 1) * height!) / 2];
        };
        const center = node.clone().project(camera);
        const bottom = project(0.5 - sprite.center.x, -sprite.center.y);
        const top = project(0.5 - sprite.center.x, 1 - sprite.center.y);
        const left = project(-sprite.center.x, -sprite.center.y);
        const right = project(1 - sprite.center.x, -sprite.center.y);
        expect(bottom[0]).toBeCloseTo(((center.x + 1) * width!) / 2, 6);
        const projectedRadius =
          (radius * camera.projectionMatrix.elements[5]! * height!) /
          (-2 * view.z);
        expect(
          bottom[1]! - ((center.y + 1) * height!) / 2 - projectedRadius,
        ).toBeCloseTo(labelPixels.gap, 6);
        expect(top[1]! - bottom[1]!).toBeCloseTo(labelPixels.height, 6);
        expect(right[0]! - left[0]!).toBeCloseTo(labelPixels.width, 6);
      }
    }
  }
  sprite.material.dispose();
});
