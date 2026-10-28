import type { GraphNode } from '../../core/graph';
import type { Position } from './hierarchy';

// Seeded variation gives an organic appearance without changing on every scan,
// expansion or reset. This is presentation only; edges remain source facts.
function randomFor(id: string) {
  let state = 2166136261;
  for (let i = 0; i < id.length; i++)
    state = Math.imul(state ^ id.charCodeAt(i), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export const minimumNodeSpacing = 7;
const goldenAngle = Math.PI * (3 - Math.sqrt(5));

export function layoutWeb(
  root: GraphNode,
  children: ReadonlyMap<string, readonly GraphNode[]>,
): Map<string, Position> {
  const positions = new Map<string, Position>([[root.id, [0, 0, 0]]]);
  const cells = new Map<string, Position[]>();
  let outerRadius = 0;
  const cell = (value: number) => Math.floor(value / minimumNodeSpacing);
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  function occupy(position: Position) {
    const address = key(...(position.map(cell) as Position));
    const bucket = cells.get(address) ?? [];
    bucket.push(position);
    cells.set(address, bucket);
    outerRadius = Math.max(outerRadius, Math.hypot(...position));
  }
  function available(position: Position) {
    const [x, y, z] = position.map(cell) as Position;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          for (const other of cells.get(key(x + dx, y + dy, z + dz)) ?? [])
            if (
              Math.hypot(
                position[0] - other[0],
                position[1] - other[1],
                position[2] - other[2],
              ) < minimumNodeSpacing
            )
              return false;
        }
    return true;
  }
  occupy([0, 0, 0]);
  const queue = [root];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const parent = queue[cursor]!;
    const origin = positions.get(parent.id)!;
    const siblings = children.get(parent.id) ?? [];
    const parentRandom = randomFor(parent.id);
    const phase = parentRandom() * Math.PI * 2;
    const tilt = parentRandom() * Math.PI * 2;
    const twist = parentRandom() * Math.PI * 2;
    const radius =
      minimumNodeSpacing * (1.8 + Math.sqrt(siblings.length) * 0.35);
    siblings.forEach((node, index) => {
      if (positions.has(node.id)) return;
      const random = randomFor(node.id);
      let position: Position = [0, 0, 0];
      let placed = false;
      for (let attempt = 0; attempt < 32; attempt++) {
        const vertical =
          attempt === 0
            ? 1 - (2 * (index + 0.5)) / siblings.length
            : random() * 2 - 1;
        const angle =
          attempt === 0 ? phase + index * goldenAngle : random() * Math.PI * 2;
        const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
        const x = Math.cos(angle) * horizontal;
        const y =
          vertical * Math.cos(tilt) -
          Math.sin(angle) * horizontal * Math.sin(tilt);
        const z =
          vertical * Math.sin(tilt) +
          Math.sin(angle) * horizontal * Math.cos(tilt);
        const distance = radius * (0.85 + random() * 0.3 + attempt * 0.08);
        position = [
          origin[0] + (x * Math.cos(twist) - y * Math.sin(twist)) * distance,
          origin[1] + (x * Math.sin(twist) + y * Math.cos(twist)) * distance,
          origin[2] + z * distance,
        ];
        if (available(position)) {
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Bounded collision work: a point beyond the occupied bounding sphere
        // is guaranteed clear, even in unusually dense/adversarial fixtures.
        const vertical = random() * 2 - 1;
        const angle = random() * Math.PI * 2;
        const horizontal = Math.sqrt(1 - vertical * vertical);
        const distance = outerRadius + minimumNodeSpacing * 2;
        position = [
          Math.cos(angle) * horizontal * distance,
          vertical * distance,
          Math.sin(angle) * horizontal * distance,
        ];
      }
      positions.set(node.id, position);
      occupy(position);
      queue.push(node);
    });
  }
  return positions;
}
