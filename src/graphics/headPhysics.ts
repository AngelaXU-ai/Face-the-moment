import { Vector2 } from 'three';
import type { FacePose } from '../face/types';

export const COMBO_REWARDS = {
  3: 'Star Flash', 5: 'Star Bloom', 10: 'Heart Pop', 15: 'Galaxy Spin', 20: 'Butterfly Bloom',
} as const;
export type ComboThreshold = keyof typeof COMBO_REWARDS;
// Distances are fractions of the projected full face width/height. The
// roll-aligned face oval ends near the forehead; the crown starts above it.
export const crownTuning = { widthRatio: .86, baseAboveFaceTop: .12, heightRatio: .46 } as const;

export function projectHead(pose: FacePose, halfWidth: number) {
  const angle = -pose.rollDegrees * Math.PI / 180;
  const upward = pose.height * (1 + 2 * crownTuning.baseAboveFaceTop);
  return {
    x: (pose.centerX * 2 - 1) * halfWidth - Math.sin(angle) * upward,
    y: 1 - pose.centerY * 2 + Math.cos(angle) * upward,
    rx: Math.max(.012, pose.width * halfWidth * crownTuning.widthRatio),
    ry: Math.max(.012, pose.height * crownTuning.heightRatio),
    angle,
  };
}

export interface ContactGate { inside: boolean; lastHit: number }
export function countContact(gate: ContactGate, touching: boolean, incoming: boolean, time: number) {
  const accepted = touching && incoming && !gate.inside && time - gate.lastHit >= .18;
  gate.inside = touching;
  if (accepted) gate.lastHit = time;
  return accepted;
}

export class CollisionCombo {
  private timestamps: number[] = [];
  private awarded = new Set<number>();
  get count() { return this.timestamps.length; }
  advance(time: number) {
    while (this.timestamps.length && time - this.timestamps[0] >= 3) this.timestamps.shift();
    if (!this.timestamps.length) this.awarded.clear();
  }
  clear() { this.timestamps.length = 0; this.awarded.clear(); }
  hit(time: number): ComboThreshold | undefined {
    this.advance(time);
    this.timestamps.push(time);
    const count = this.count as ComboThreshold;
    if (!(count in COMBO_REWARDS) || this.awarded.has(count)) return;
    this.awarded.add(count);
    return count;
  }
}

export function projectFaceEnvelope(pose: FacePose, halfWidth: number) {
  const angle = -pose.rollDegrees * Math.PI / 180;
  const ry = Math.max(.035, pose.height * 1.18);
  const upward = pose.height * .18;
  return {
    x: (pose.centerX * 2 - 1) * halfWidth - Math.sin(angle) * upward,
    y: 1 - pose.centerY * 2 + Math.cos(angle) * upward,
    rx: Math.max(.028, pose.width * halfWidth * 1.1), ry, angle,
  };
}

export interface Contact {
  x: number; y: number; nx: number; ny: number; beforeX: number; beforeY: number;
  afterX: number; afterY: number; energy: number;
}
type XY = { x: number; y: number };

export class HeadCollider {
  x = 0; y = 0; rx = 0; ry = 0; angle = 0;
  private c = 1;
  private s = 0;
  private readonly velocity = new Vector2();
  private valid = false;
  private width = 0;
  private dx = 0;
  private dy = 0;
  readonly contact: Contact = {x: 0, y: 0, nx: 0, ny: 0, beforeX: 0, beforeY: 0, afterX: 0, afterY: 0, energy: 0};

  update(pose: FacePose | null, halfWidth: number, dt: number) {
    if (!pose) { this.valid = false; this.velocity.set(0, 0); return; }
    const head = projectHead(pose, halfWidth);
    const continuous = this.valid && this.width === halfWidth && Math.hypot(head.x - this.x, head.y - this.y) < .5;
    const alpha = continuous ? 1 - Math.exp(-dt * 16) : 1;
    const oldX = this.x, oldY = this.y;
    this.x += (head.x - this.x) * alpha;
    this.y += (head.y - this.y) * alpha;
    this.rx += (head.rx - this.rx) * alpha;
    this.ry += (head.ry - this.ry) * alpha;
    this.angle += (head.angle - this.angle) * alpha;
    this.dx = continuous ? this.x - oldX : 0;
    this.dy = continuous ? this.y - oldY : 0;
    const blend = 1 - Math.exp(-dt * 8);
    const vx = this.dx / Math.max(dt, .001), vy = this.dy / Math.max(dt, .001);
    this.velocity.set(this.velocity.x + (vx - this.velocity.x) * blend, this.velocity.y + (vy - this.velocity.y) * blend).clampLength(0, 1.4);
    if (!continuous) this.velocity.set(0, 0);
    this.c = Math.cos(this.angle);
    this.s = Math.sin(this.angle);
    this.valid = true;
    this.width = halfWidth;
  }

  solve(from: XY, to: XY, velocity: XY, radius: number): Contact | null {
    if (!this.valid) return null;
    const { c, s, x, y } = this;
    const rx = this.rx + radius, ry = this.ry + radius;
    const ax = from.x - x + this.dx, ay = from.y - y + this.dy;
    const bx = to.x - x, by = to.y - y;
    const boundX = Math.hypot(rx * c, ry * s), boundY = Math.hypot(rx * s, ry * c);
    if (Math.min(ax, bx) > boundX || Math.max(ax, bx) < -boundX ||
        Math.min(ay, by) > boundY || Math.max(ay, by) < -boundY) return null;
    const ox = (ax * c + ay * s) / rx, oy = (-ax * s + ay * c) / ry;
    const ex = (bx * c + by * s) / rx, ey = (-bx * s + by * c) / ry;
    const dx = ex - ox, dy = ey - oy;
    const a = dx * dx + dy * dy;
    const b = ox * dx + oy * dy;
    const k = ox * ox + oy * oy - 1;
    // This is an open crown arc. Entering through its underside, or
    // crossing the horizontal chord below it, never causes a collision.
    const endInside = ey >= 0 && ex * ex + ey * ey < 1;
    if (k < 0 && (oy < 0 || !endInside)) return null;
    const disc = b * b - a * k;
    if (!endInside && (k < 0 || a < 1e-12 || disc < 0)) return null;
    const t = k < 0 || a < 1e-12 ? 1 : (-b - Math.sqrt(Math.max(0, disc))) / a;
    if (!endInside && (t < 0 || t > 1)) return null;
    let ux = ox + dx * t, uy = oy + dy * t;
    if (uy <= 0) return null;
    const length = Math.hypot(ux, uy);
    ux /= length; uy /= length;
    const nx = ux / rx * c - uy / ry * s, ny = ux / rx * s + uy / ry * c;
    const norm = Math.hypot(nx, ny);
    const normalX = nx / norm, normalY = ny / norm;
    const localX = ux * rx, localY = uy * ry;
    const sx = x + localX * c - localY * s, sy = y + localX * s + localY * c;
    const beforeX = velocity.x, beforeY = velocity.y;
    const relativeX = beforeX - this.velocity.x, relativeY = beforeY - this.velocity.y;
    const approach = relativeX * normalX + relativeY * normalY;
    if (approach >= 0) return null;
    if (approach < 0) {
      velocity.x = .9 * relativeX - 1.58 * approach * normalX + this.velocity.x;
      velocity.y = .9 * relativeY - 1.58 * approach * normalY + this.velocity.y;
      const cap = Math.min(1, 2.3 / Math.max(.001, Math.hypot(velocity.x, velocity.y)));
      velocity.x *= cap; velocity.y *= cap;
    }
    to.x = sx + normalX * .008;
    to.y = sy + normalY * .008;
    Object.assign(this.contact, {
      x: sx - normalX * radius, y: sy - normalY * radius, nx: normalX, ny: normalY,
      beforeX, beforeY, afterX: velocity.x, afterY: velocity.y, energy: Math.max(0, -approach),
    });
    return this.contact;
  }
}
