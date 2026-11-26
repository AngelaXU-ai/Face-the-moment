import * as T from 'three';
import type P5 from 'p5';
import type { FacePose } from '../face/types';
import { CollisionCombo, countContact, HeadCollider, projectFaceEnvelope, type Contact, type ComboThreshold } from './headPhysics';
import { atmosphere } from './atmosphericPalette';
import { drawFireworkRings, FireworkGlow, type LightColor } from './FireworkLight';

export const fireworkShapes = ['SPHERE', 'STAR', 'HEART', 'SPIRAL', 'BUTTERFLY'] as const;
export const fireworkThemes = {
  Candy: [atmosphere.ice, atmosphere.teal, atmosphere.violet, atmosphere.silver, atmosphere.pink],
  Golden: [atmosphere.silver, atmosphere.gold, atmosphere.ice, atmosphere.teal],
  Dream: [atmosphere.violet, atmosphere.blue, atmosphere.silver, atmosphere.pink],
  Rainbow: [atmosphere.ice, atmosphere.teal, atmosphere.blue, atmosphere.violet, atmosphere.silver, atmosphere.pink, atmosphere.gold],
} as const;
export type FireworkShape = typeof fireworkShapes[number];
export type FireworkTheme = keyof typeof fireworkThemes;
export type FireworkSettings = { shape: FireworkShape; theme: FireworkTheme; strength: number; reduced: boolean };

const CAPACITY = 120;
const V = T.Vector3;
const rnd = (i: number) => T.MathUtils.euclideanModulo(Math.sin(i * 127.1) * 43758.54, 1);

export function fireworkDirection(shape: FireworkShape, i: number, count: number) {
  const a = i / count * Math.PI * 2;
  const z = rnd(i + 1) * .44 - .22;
  switch (shape) {
    case 'SPHERE': {
      const height = 1 - 2 * (i + .5) / count;
      const theta = i * 2.399963;
      const radius = Math.sqrt(1 - height * height);
      return new V(radius * Math.cos(theta), height, radius * Math.sin(theta) * .63);
    }
    case 'STAR': {
      const f = i / count * 10;
      const edge = Math.floor(f);
      const vertex = (j: number) => {
        const angle = Math.PI / 2 + j * Math.PI / 5;
        const r = j % 2 ? .43 : 1;
        return new V(Math.cos(angle) * r, Math.sin(angle) * r, z);
      };
      return vertex(edge).lerp(vertex(edge + 1), f - edge);
    }
    case 'HEART':
      return new V(Math.sin(a) ** 3, (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a) + 2) / 17, z);
    case 'SPIRAL': {
      const p = Math.floor(i / 2) / Math.ceil(count / 2);
      const angle = p * 7.4 + (i % 2) * Math.PI;
      const r = .15 + .85 * p;
      return new V(Math.cos(angle) * r, Math.sin(angle) * r * .85, z);
    }
    case 'BUTTERFLY': {
      const wing = Math.floor(i / 2) / Math.ceil(count / 2) * Math.PI * 2;
      const r = .48 + .48 * Math.sin(wing);
      return new V((i % 2 ? -1 : 1) * (.1 + r * (.55 + .45 * Math.cos(wing))), .8 * Math.cos(wing) + .12 * Math.sin(wing), z);
    }
  }
}

export function bloomColorIndex(sequence: number, burst: number) {
  return (sequence * 2 + burst) % 5;
}

const clamp = T.MathUtils.clamp;
const ease = T.MathUtils.smoothstep;

const burstRadiusScale = .975;

type Burst = { x: number; y: number; startX: number; startY: number; start: number; delay: number; radiusX: number; radiusY: number };

export function planFireworks(strength: number, sequence: number, halfWidth: number, pose: FacePose | null): Burst[] {
  const power = clamp(strength, 0, 1);
  const count = power >= .82 || (power >= .62 && sequence % 3 === 0) ? 5 : 4;
  const side = sequence % 2 === 0 ? -1 : 1;
  const ceiling = pose ? clamp(1 - 2 * pose.centerY + pose.height * 1.16, .17, .68) : .34;
  const primaryY = clamp(ceiling + .11 + power * .19, .41, .77);
  const offsets = [side * .32, -side * .39, side * .69, -side * .73, -side * .06];
  const upper = sequence % 4 < 2 ? 0 : 1;
  const maxRadius = Math.min(halfWidth, 1.38);
  const headX = pose ? clamp(pose.centerX * 2 - 1, -.72, .72) : 0;
  return offsets.slice(0, count).map((offset, i) => {
    const accent = i >= 3;
    const base = [.53, .42, .34, .27, .21][i];
    const y = i === 4 ? clamp(primaryY + .10, .66, .79) : primaryY - (i === upper ? 0 : [.14, .18, .38, .47][i]);
    const start = i * .28;
    const stageX = clamp(offset + headX * .52, -.79, .79);
    return {
      x: halfWidth * stageX, y,
      startX: halfWidth * clamp(stageX * 1.47, -.9, .9),
      startY: -.90 + i * .036,
      start, delay: start + .73 + i * .065,
      radiusX: maxRadius * base * (.72 + power * .32) * burstRadiusScale,
      radiusY: Math.min(1.04 - y, .46, halfWidth * .76) * (accent ? .85 : 1) * (.72 + power * .31) * burstRadiusScale,
    };
  });
}


const TAU = 2 * Math.PI;
export const FIREWORK_REPEAT_MS = 2420;
const HISTORY = 54;
const SAMPLE_INTERVAL = 1 / 45;
const PEARL = [255, 248, 230] as const;
const CHAMPAGNE = [242, 210, 157] as const;
const ICE = [181, 207, 225] as const;
const VERMILION = [223, 146, 126] as const;
const RUBY = [205, 123, 128] as const;
const ROSE_GOLD = [221, 165, 154] as const;
const stars = Array.from({length: 80}, (_, i) => {
  const angle = i * 2.399963;
  return {x: Math.cos(angle), y: Math.sin(angle), spread: rnd(i + 41), pulse: rnd(i + 97)};
});
const IMPACT = [255, 234, 177] as const;

// Primary, supporting tint, light tip, and a local contrast accent.
const basePalettes: readonly (readonly LightColor[])[] = [
  [CHAMPAGNE, [230, 188, 140], PEARL, ROSE_GOLD],
  [RUBY, [234, 184, 138], [252, 232, 222], [222, 151, 158]],
  [[162, 192, 217], CHAMPAGNE, [213, 230, 238], ICE],
  [[224, 160, 110], [211, 148, 109], PEARL, VERMILION],
  [[218, 153, 143], [220, 176, 128], [249, 226, 216], [188, 202, 215]],
];

const paletteChroma = 1.04;
const PALETTES = basePalettes.map(palette => palette.map(([r, g, b]): LightColor => {
  const luminance = .2126 * r + .7152 * g + .0722 * b;
  const enrich = (channel: number) => clamp(luminance + (channel - luminance) * paletteChroma, 0, 255);
  return [enrich(r), enrich(g), enrich(b)];
}));

export const fireworkPatterns = [
  {name: 'ORBITAL BLOOM', count: 159, rings: 15, speed: 1, gravity: .38, drag: 1.10, trail: 54, life: 2.08},
  {name: 'CHRYSANTHEMUM', count: 182, rings: 9, speed: 1.15, gravity: .42, drag: .95, trail: 46, life: 2.12},
  {name: 'WILLOW', count: 151, rings: 7, speed: .79, gravity: .69, drag: .73, trail: 43, life: 2.34},
  {name: 'HALO BURST', count: 140, rings: 12, speed: .91, gravity: .27, drag: 1.25, trail: 39, life: 2.03},
] as const;

type Pattern = typeof fireworkPatterns[number];
export type FireworkCue = {
  kind: 'launch' | 'burst'; index: number; seed: number; pan: number; strength: number; duration: number;
};

type SceneBurst = Burst & {pattern: Pattern; colors: readonly LightColor[]; fired: boolean; started: boolean; index: number; seed: number; strength: number};
type Actor = ReturnType<typeof createActor>;

function createActor() {
  return {
    p: {x: 0, y: 0}, v: {x: 0, y: 0}, prev: {x: 0, y: 0},
    historyX: new Float32Array(HISTORY), historyY: new Float32Array(HISTORY),
    cursor: 0, stored: 0, sample: 0, trail: 0, age: 0, life: 0,
    gravity: 0, drag: 0, turn: 0, phase: 0, width: 0, nextSpark: 0,
    color: PEARL as LightColor, kind: 0, glint: false,
    inside: false, lastHit: -10,
  };
}

export function radialVelocity(index: number, count: number, jitter: number, speed: number) {
  const angle = TAU * index / count + jitter;
  return {x: Math.cos(angle) * speed, y: Math.sin(angle) * speed};
}

export class FireworkEmitter {
  readonly head = new HeadCollider();
  readonly combo = new CollisionCombo();
  lastContact: Contact | null = null;
  lastReward: ComboThreshold | null = null;
  private t = 0;
  private clock = 0;
  private headCos = 1;
  private headSin = 0;
  private width = .56;
  private sequence = 0;
  private liveCount = 0;
  private bursts: SceneBurst[] = [];
  private faceEnvelope: ReturnType<typeof projectFaceEnvelope> | null = null;
  private reduced = false;
  private readonly pool: Actor[];
  private readonly glow = new FireworkGlow();
  private readonly trailShades = new Map<LightColor, readonly LightColor[]>();
  private readonly strokes = new Map<LightColor, string>();

  constructor(private readonly mobile: boolean) {
    this.pool = Array.from({length: mobile ? 580 : 960}, createActor);
  }

  get active() { return this.liveCount > 0 || this.bursts.length > 0; }
  get pendingBurstCount() { return this.bursts.reduce((count, b) => count + Number(!b.fired), 0); }
  get particleCount() { return this.liveCount; }

  launch(settings: FireworkSettings, halfWidth: number, pose: FacePose | null = null) {
    if (this.pendingBurstCount >= 5) return;
    this.reduced = settings.reduced;
    const sequence = this.sequence++;
    this.bursts.push(...planFireworks(settings.strength, sequence + 1, this.widthForLaunch(halfWidth), pose).map((burst, i) => ({
      ...burst, start: this.t + burst.start, delay: this.t + burst.delay,
      pattern: fireworkPatterns[(sequence + i) % fireworkPatterns.length],
      colors: PALETTES[bloomColorIndex(sequence, i)], fired: false, started: false,
      index: i, seed: sequence * 131 + i * 43, strength: settings.strength,
    })));
  }

  private widthForLaunch(halfWidth: number) {
    if (!this.active) this.width = halfWidth;
    return this.width;
  }

  clear() {
    this.bursts.length = 0;
    this.liveCount = 0;
    this.combo.clear();
    this.lastContact = this.lastReward = null;
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, gravity: number,
    drag: number, color: LightColor, kind: number, phase: number, width: number, trail = 0, delay = 0) {
    // Reserve capacity for the next primary and its supporting filaments.
    if (kind !== 0 && this.liveCount >= this.pool.length - (this.mobile ? 144 : 218)) return;
    const p = this.pool[this.liveCount];
    if (!p) return;
    this.liveCount++;
    p.p.x = p.prev.x = x; p.p.y = p.prev.y = y;
    p.v.x = vx; p.v.y = vy;
    p.age = -delay; p.life = life; p.gravity = gravity; p.drag = drag;
    p.turn = kind === 0 && !this.reduced ? Math.sin(phase * 2.3) * (gravity > .36 ? .78 : 1.34) : 0;
    p.color = color; p.kind = kind; p.phase = phase; p.width = width; p.trail = trail;
    p.cursor = 0; p.stored = 1; p.sample = 0;
    p.historyX[0] = x; p.historyY[0] = y;
    p.nextSpark = .13 + phase * .026;
    p.glint = phase < 1.66; p.inside = false; p.lastHit = -10;
  }

  private explode(b: SceneBurst) {
    const pattern = b.pattern;
    const group = b.index;
    const count = Math.round(pattern.count * [1, .77, .61, .48, .39][group] * (this.reduced ? .51 : this.mobile ? .76 : 1));
    const seed = b.seed;
    const stageRadius = Math.min(b.radiusX, Math.max(.22 * burstRadiusScale, b.radiusY) * 1.71);
    const expansion = group === 0 ? 1.165 : group === 1 ? 1.125 : group === 4 ? 1.065 : 1.095;
    const speed = stageRadius * expansion * (1.91 + b.strength * .36) * pattern.speed;
    for (let i = 0; i < count; i++) {
      const n = seed + i * 11;
      const angle = i / count * TAU;
      const jitter = (rnd(n) - .5) * TAU / count * .45;
      // Gentle scalloping gives the velocity bands a petal-like silhouette.
      const petal = .90 + .10 * Math.cos(angle * (group % 2 ? 7 : 9) + seed);
      const variation = pattern.name === 'HALO BURST' ? (i % 3 ? .94 + rnd(n + 1) * .12 : .53) : ([.50, .73, .96][i % 3] + rnd(n + 1) * .14) * petal;
      const v = radialVelocity(i, count, jitter + group * .34, speed * variation);
      const delay = (i % 3) * .035 + rnd(n + 8) * .035;
      this.spawn(b.x, b.y, v.x, v.y * .82, pattern.life * (.76 + rnd(n + 2) * .24) * (this.reduced ? 1.14 : 1.36),
        pattern.gravity * (.78 + rnd(n + 3) * .43), pattern.drag * (.81 + rnd(n + 4) * .38),
        i % 29 === 0 ? ICE : b.colors[i % 9 === 0 ? 3 : i % 13 === 0 ? 2 : i % 4 === 0 ? 1 : 0], 0, rnd(n + 5) * TAU, .00155 + rnd(n + 6) * .0023,
        Math.round(pattern.trail * (.59 + rnd(n + 7) * .30 + (i % 3) * .055)), delay);
    }
    const dots = this.reduced ? 14 : this.mobile ? 40 : group === 0 ? 100 : group === 4 ? 42 : 67;
    for (let i = 0; i < dots; i++) {
      const n = seed + 667 + i * 7;
      const band = i % 3;
      const velocity = speed * (i % 5 === 0 ? .77 + band * .05 : .16 + band * .17);
      const v = radialVelocity(i, dots, rnd(n) * .11, velocity);
      this.spawn(b.x, b.y, v.x, v.y * .84, .71 + rnd(n + 1) * 1.08, pattern.gravity * .55,
        pattern.drag * 1.07, b.colors[i % 9 === 0 ? 3 : i % 5 === 0 ? 2 : i % 3 === 0 ? 1 : 0], 1, rnd(n + 2) * TAU, .002 + rnd(n + 3) * .0044);
    }
  }

  update(dt: number, pose: FacePose | null, onHit: () => void, halfWidth = this.width, now = this.clock + dt, onCue?: (cue: FireworkCue) => void, emitting = true) {
    this.clock = now;
    this.combo.advance(now);
    if (!this.combo.count) this.lastReward = null;
    this.head.update(pose, halfWidth, dt);
    this.faceEnvelope = pose ? projectFaceEnvelope(pose, halfWidth) : null;
    if (this.faceEnvelope) {
      this.headCos = Math.cos(this.faceEnvelope.angle);
      this.headSin = Math.sin(this.faceEnvelope.angle);
    }
    if (!pose) this.lastContact = null;
    if (!this.active) { this.liveCount = 0; return false; }
    if (halfWidth !== this.width) {
      const ratio = halfWidth / this.width;
      for (const burst of this.bursts) {
        burst.x *= ratio; burst.startX *= ratio; burst.radiusX *= ratio;
      }
      for (let i = 0; i < this.liveCount; i++) {
        const p = this.pool[i];
        p.p.x *= ratio; p.prev.x *= ratio; p.v.x *= ratio;
        for (let j = 0; j < p.stored; j++) p.historyX[j] *= ratio;
      }
      this.width = halfWidth;
    }
    this.t += dt;
    let i = 0;
    while (i < this.liveCount) {
      const p = this.pool[i];
      // Give the first outward movement a little more screen time.
      const step = p.kind === 0 && p.age < .54 ? dt / 1.19 : dt;
      p.age += step;
      if (p.age < 0) { i++; continue; }
      if (p.age >= p.life) {
        this.pool[i] = this.pool[--this.liveCount];
        this.pool[this.liveCount] = p;
        if (emitting && p.kind === 0 && !this.reduced && p.phase < 3.15) {
          // Carry a selection of burning tips into an independent ember fade.
          this.spawn(p.p.x, p.p.y, p.v.x * .23, p.v.y * .25, .77 + p.phase * .18,
            .095, 1.85, p.color, 2, p.phase, p.width * 1.25);
        }
        continue;
      }
      i++;
      this.advanceActor(p, Math.min(step, p.age), now, onHit, emitting);
    }
    for (let j = this.bursts.length - 1; j >= 0; j--) {
      const b = this.bursts[j];
      if (this.t - b.delay > 1.66) { this.bursts.splice(j, 1); continue; }
      if (!emitting) continue;
      if (!b.started && this.t >= b.start) {
        b.started = true;
        this.emitCue(b, 'launch', onCue);
      }
      if (!b.fired && this.t >= b.delay) {
        b.fired = true;
        this.explode(b);
        this.emitCue(b, 'burst', onCue);
      }
    }
    if (!this.active) { this.liveCount = 0; return false; }
    return true;
  }

  private emitCue(b: SceneBurst, kind: FireworkCue['kind'], onCue?: (cue: FireworkCue) => void) {
    onCue?.({kind, index: b.index, seed: b.seed, pan: b.x / this.width, strength: b.strength, duration: b.pattern.life});
  }

  private advanceActor(p: Actor, dt: number, now: number, onHit: () => void, emitting: boolean) {
    p.prev.x = p.p.x; p.prev.y = p.p.y;
    const settling = p.kind === 0 ? ease(p.age, 1.65, p.life) : 0;
    const gravityRamp = (.47 + .72 * ease(p.age, .29, 1.05)) * (1 - settling * .53);
    const resistance = Math.exp(-dt * (p.drag + .32 * Math.hypot(p.v.x, p.v.y) + settling * 1.15));
    // A brief signed crosswind bends actual trajectories after the radial reveal.
    const turn = p.turn * ease(p.age, .07, .38) * (1 - ease(p.age, .60, 1.20)) * dt;
    const vx = p.v.x;
    p.v.x = (vx - p.v.y * turn) * resistance * (1 - dt * .62 * ease(p.age, .26, .81));
    p.v.y = (p.v.y + vx * turn) * resistance - p.gravity * gravityRamp * dt;
    p.p.x += p.v.x * dt; p.p.y += p.v.y * dt;
    const contact = emitting && p.kind === 0 && p.age > .045 ? this.head.solve(p.prev, p.p, p.v, p.width) : null;
    if (countContact(p, Boolean(contact), Boolean(contact && contact.energy > .025), now) && contact) {
      this.lastContact = {...contact};
      p.color = IMPACT;
      p.turn = 0;
      const tangent = .034 * Math.sin(p.phase);
      p.v.x -= contact.ny * tangent;
      p.v.y += contact.nx * tangent;
      p.stored = 1; p.cursor = 0;
      p.historyX[0] = p.p.x; p.historyY[0] = p.p.y;
      const reward = this.combo.hit(now);
      if (reward) this.lastReward = reward;
      for (let j = 0; j < (this.reduced ? 2 : reward ? 8 : 4); j++) {
        const sideways = (j % 4 - 1.5) * .10;
        this.spawn(contact.x, contact.y, contact.nx * .31 - contact.ny * sideways,
          contact.ny * .31 + contact.nx * sideways, .42 + j * .034, .19, 1.8, IMPACT, 1, j, .0046);
      }
      onHit();
    }
    if (p.kind !== 0) return;
    p.sample += dt;
    if (p.sample >= SAMPLE_INTERVAL) {
      p.sample %= SAMPLE_INTERVAL;
      p.cursor = (p.cursor + 1) % HISTORY;
      p.stored = Math.min(p.stored + 1, HISTORY);
      p.historyX[p.cursor] = p.p.x; p.historyY[p.cursor] = p.p.y;
    }
    if (emitting && !this.reduced && p.age >= p.nextSpark && p.age < p.life * .86) {
      p.nextSpark += .30 + p.phase * .049;
      this.spawn(p.p.x, p.p.y, p.v.x * .18 + Math.cos(p.phase) * .042,
        p.v.y * .48, .44 + p.phase * .071, p.gravity * .57, 1.95, p.color, 1, p.phase, p.width * 1.12);
    }
  }

  draw(p5: P5) {
    const ctx = p5.drawingContext as CanvasRenderingContext2D;
    for (const b of this.bursts) {
      if (this.t < b.start) continue;
      if (!b.fired) { this.drawRocket(p5, ctx, b); continue; }
      const age = this.t - b.delay;
      const visible = this.visibilityAt(b.x, b.y);
      const flash = 1 - ease(age, .045, .38);
      const ringRadius = Math.min(b.radiusX, b.radiusY * 1.79);
      const haloRadius = ringRadius * (.34 + .66 * ease(age, .015, .60));
      const haloAlpha = ease(age, .02, .17) * (1 - ease(age, .37, 1.26)) * visible;
      this.glow.draw(ctx, b.x, b.y, haloRadius * 1.13, b.colors[0],
        haloAlpha * (this.reduced ? .24 : .55 + .08 * Math.sin(age * 13 + b.seed)), true);
      if (!this.reduced) this.glow.draw(ctx, b.x, b.y, haloRadius * .71, b.colors[3],
        haloAlpha * (.24 + .06 * Math.sin(age * 12 + b.seed)), true);
      if (!this.reduced) this.drawHaloGlints(p5, b, age, haloRadius * .84, haloAlpha);
      const ember = (1 - ease(age, .20, .86)) * visible;
      this.glow.draw(ctx, b.x, b.y, .049, PEARL, ember * .76);
      this.glow.draw(ctx, b.x, b.y, .095 + age * .055, b.colors[0], flash * visible * (this.reduced ? .48 : .93));
      if (flash > 0) {
        this.glow.draw(ctx, b.x + .019, b.y - .006, .060, b.colors[1], flash * visible * .90);
        p5.noStroke();
        p5.fill(255, 252, 246, flash * visible * 245);
        p5.circle(b.x, b.y, .040 * Math.sqrt(flash));
      }
      this.drawCoreGlints(p5, b, age, ringRadius);
      this.drawMiniBursts(p5, ctx, b, age, ringRadius);
      this.drawStardust(p5, ctx, b, age, ringRadius, visible);
      drawFireworkRings(p5, b.x, b.y, age, ringRadius, this.reduced ? Math.min(2, b.pattern.rings) : b.pattern.rings,
        b.pattern.name === 'HALO BURST', b.colors, visible);
    }
    for (let i = 0; i < this.liveCount; i++) {
      const p = this.pool[i];
      if (p.age < 0 || p.p.y < -1.65) continue;
      const progress = p.age / p.life;
      const fadeRatio = p.kind === 2 ? ease(progress, 0, .13) * (1 - ease(progress, .26, 1)) : 1 - ease(progress, p.kind === 0 ? .63 : .32, 1);
      const visible = fadeRatio * this.visibilityAt(p.p.x, p.p.y);
      if (visible < .012) continue;
      const falling = p.kind === 0 ? ease(p.age, .31, .95) * ease(-p.v.y, .03, .22) : 0;
      const twinkle = Math.max(0, Math.sin(p.phase + p.age * (p.kind === 2 ? 11 + p.phase * .66 : 14 + p.phase * 1.45))) ** 2;
      const irregular = .72 + .28 * Math.sin(p.age * 7.2 + p.phase * 2.7) ** 2;
      const pulse = p.kind === 0 ? 1 - falling * .31 * (1 - twinkle * irregular) : .30 + .70 * twinkle * irregular;
      if (p.kind === 0) this.drawTrail(ctx, p, visible, falling);
      const alpha = visible * pulse;
      const radius = p.width * (p.kind === 0 ? 4.7 + falling * (2.4 + twinkle * 1.4) : p.kind === 2 ? 4.7 : 2.7);
      this.glow.draw(ctx, p.p.x, p.p.y, radius, p.color, alpha);
      p5.noStroke();
      const [r, g, b] = p.color;
      const white = p.kind === 0 ? .31 + .36 * (1 - ease(progress, .08, .60)) + falling * .18 : .46;
      p5.fill(r + (255 - r) * white, g + (248 - g) * white, b + (230 - b) * white,
        alpha * (p.kind === 0 ? 242 : 193));
      p5.circle(p.p.x, p.p.y, p.width * (1.20 + falling * twinkle * .35));
      if ((p.kind === 2 || (p.glint && (p.kind === 1 || falling * twinkle > .37))) && !this.reduced && pulse > .67) {
        const ray = p.width * (1.2 + pulse);
        p5.stroke(246, 250, 255, alpha * 181);
        p5.strokeWeight(.00125);
        p5.line(p.p.x - ray, p.p.y, p.p.x + ray, p.p.y);
        p5.line(p.p.x, p.p.y - ray * 1.37, p.p.x, p.p.y + ray * 1.37);
      }
    }
  }

  private drawCoreGlints(p: P5, burst: SceneBurst, age: number, radius: number) {
    if (age >= .47) return;
    const fade = (1 - ease(age, .15, .46)) * ease(age, 0, .043);
    const expansion = .13 + .87 * (1 - Math.exp(-age * 8.2));
    const count = this.reduced ? 17 : this.mobile ? 48 : burst.index === 0 ? 78 : 55;
    const turn = burst.seed * .09;
    const c = Math.cos(turn), s = Math.sin(turn);
    for (let i = 0; i < count; i++) {
      const star = stars[i];
      const range = radius * expansion * (.10 + .32 * star.spread);
      const dx = (star.x * c - star.y * s) * range;
      const dy = (star.x * s + star.y * c) * range * .90;
      const x = burst.x + dx, y = burst.y + dy;
      const twinkle = .64 + .36 * Math.sin(age * 17 + i * 2.1) ** 2;
      const alpha = fade * twinkle * this.visibilityAt(x, y);
      const color = burst.colors[i % 9 === 0 ? 3 : i % 4 === 0 ? 2 : i % 3 === 0 ? 1 : 0];
      if (i % 3 !== 1) {
        p.stroke(color[0], color[1], color[2], alpha * 176);
        p.strokeWeight(.0009 + star.pulse * .001);
        const stem = .16 + star.pulse * .31;
        p.line(x - dx * stem, y - dy * stem, x, y);
      }
      p.noStroke();
      p.fill(color[0], color[1], color[2], alpha * 236);
      p.circle(x, y, .0022 + star.pulse * .004);
    }
  }

  private drawStardust(p: P5, ctx: CanvasRenderingContext2D, burst: SceneBurst, age: number,
    radius: number, visibility: number) {
    const time = age - .93;
    if (time <= 0 || time >= .73 || visibility < .025) return;
    const decay = 1 - ease(time, .24, .72);
    const envelope = decay * ease(time, 0, .055);
    // Three short peaks on one small light, independent of the surrounding sparks.
    const pulse = envelope * Math.max(0, Math.sin(time * 28.6 + .55)) ** 4;
    this.glow.draw(ctx, burst.x, burst.y, radius * .097, burst.colors[1],
      visibility * (.15 * envelope + .72 * pulse));
    if (pulse > .04) {
      p.noStroke();
      p.fill(255, 249, 225, pulse * visibility * 223);
      p.circle(burst.x, burst.y, .0045 + .006 * pulse);
    }
    const count = this.reduced ? 14 : this.mobile ? 38 : 72;
    const travel = .19 + .81 * (1 - Math.exp(-time * 9.6));
    const c = Math.cos(burst.seed * .17), s = Math.sin(burst.seed * .17);
    for (let i = 0; i < count; i++) {
      const star = stars[i];
      const distance = travel * radius * (.105 + .27 * star.spread);
      const x = burst.x + (star.x * c - star.y * s) * distance;
      const y = burst.y + (star.x * s + star.y * c) * distance * .89 - time * time * .027;
      const wave = Math.max(0, Math.sin(time * (19 + 13 * star.pulse) + star.spread * TAU)) ** 3;
      const tail = 1 - ease(time, .21 + star.spread * .16, .50 + star.pulse * .22);
      const light = envelope * tail * (.47 + wave * .53) * this.visibilityAt(x, y);
      if (light < .025) continue;
      const color = i % 19 === 0 ? ICE : burst.colors[i % 8 === 0 ? 3 : i % 4 === 0 ? 2 : i % 3 === 0 ? 1 : 0];
      p.noStroke();
      p.fill(color[0], color[1], color[2], light * 250);
      const dot = .0026 + star.pulse * .0030;
      p.circle(x, y, dot);
      if (!this.reduced && wave > .72 && i % 5 === 0) {
        p.stroke(255, 246, 216, light * 155);
        p.strokeWeight(.0009);
        p.line(x - dot * 1.3, y, x + dot * 1.3, y);
        p.line(x, y - dot * 1.6, x, y + dot * 1.6);
      }
    }
  }

  private drawMiniBursts(p: P5, ctx: CanvasRenderingContext2D, burst: SceneBurst, age: number, radius: number) {
    const phase = age - .45;
    if (phase < 0 || phase > .83) return;
    const count = this.reduced ? 3 : this.mobile ? 6 : burst.index === 0 ? 10 : 8;
    for (let i = 0; i < count; i++) {
      const seed = burst.seed + i * 47;
      const time = phase - i * .038 - rnd(seed + 16) * .026;
      if (time <= 0 || time >= .48) continue;
      const angle = i * 2.399963 + rnd(seed + 9) * .78;
      const distance = i === 0 ? 0 : radius * (.10 + Math.sqrt(rnd(seed + 12)) * .44);
      const x = burst.x + Math.cos(angle) * distance;
      const y = burst.y + Math.sin(angle) * distance * .87;
      const visibility = this.visibilityAt(x, y);
      const spread = 1 - Math.exp(-time * 9.2);
      const fade = ease(time, 0, .028) * (1 - ease(time, .13, .47));
      const scale = radius * (.10 + rnd(seed + 5) * .085);
      const color = burst.colors[i % 4 === 0 ? 2 : i % 3 === 0 ? 3 : i % 2 === 0 ? 1 : 0];
      const rays = this.reduced ? 8 : 10 + Math.floor(rnd(seed + 3) * 11);
      if (time < .15) {
        this.glow.draw(ctx, x, y, scale * .72, color, visibility * fade * (1 - ease(time, .035, .15)) * .73);
      }
      for (let ray = 0; ray < rays; ray++) {
        const turn = ray / rays * TAU + angle + (rnd(seed + ray * 3) - .5) * .21;
        const reach = scale * spread * (.50 + rnd(seed + ray + 51) * .50);
        const dx = Math.cos(turn) * reach;
        const dy = Math.sin(turn) * reach * .92;
        const tipX = x + dx;
        const tipY = y + dy - time * time * .023;
        const shimmer = .63 + .37 * Math.sin(ray * 2.2 + time * (15 + i)) ** 2;
        const strength = fade * shimmer * this.visibilityAt(tipX, tipY);
        const thread = ray % 4 === 0 ? burst.colors[2] : color;
        p.noFill();
        p.stroke(thread[0], thread[1], thread[2], strength * 166);
        p.strokeWeight(.00085 + (ray % 3) * .00019);
        p.bezier(x + dx * .36, y + dy * .36, x + dx * .55, y + dy * .63,
          x + dx * .84, tipY - dy * .12, tipX, tipY);
        p.noStroke();
        p.fill((color[0] + 255) / 2, (color[1] + 248) / 2, (color[2] + 240) / 2, strength * 253);
        p.circle(tipX, tipY, .0018 + (ray % 3) * .00065);
      }
    }
  }

  private drawHaloGlints(p: P5, b: SceneBurst, age: number, radius: number, alpha: number) {
    if (alpha < .025) return;
    p.noStroke();
    for (let i = 0; i < (this.mobile ? 13 : 26); i++) {
      const angle = i * 2.399963 + b.seed;
      const r = radius * (.83 + .18 * Math.cos(angle * 6));
      const x = b.x + Math.cos(angle) * r, y = b.y + Math.sin(angle) * r * .93;
      const pulse = Math.max(0, Math.sin(angle * 5 + age * (13 + i % 7))) ** 3;
      const glow = alpha * pulse * this.visibilityAt(x, y);
      if (glow < .03) continue;
      const color = b.colors[i % 3];
      p.fill(color[0], color[1], color[2], glow * 228);
      p.circle(x, y, .003 + pulse * .0044);
    }
  }

  private drawTrail(ctx: CanvasRenderingContext2D, p: Actor, visible: number, falling: number) {
    const length = Math.min(p.trail, p.stored);
    if (length < 2) return;
    ctx.save();
    const shades = this.shadesFor(p.color);
    let previousShade = -1;
    ctx.lineCap = 'round';
    let endX = p.p.x, endY = p.p.y;
    for (let j = 0; j < length - 1;) {
      const stride = j < 8 ? 2 : j < 20 ? 3 : 4;
      const current = (p.cursor - Math.min(j + 1, length - 2) + HISTORY) % HISTORY;
      const older = (p.cursor - Math.min(j + 1 + stride, length - 1) + HISTORY) % HISTORY;
      const x = p.historyX[current], y = p.historyY[current];
      const tip = j + stride >= length - 1;
      const targetX = tip ? p.historyX[older] : (x + p.historyX[older]) / 2;
      const targetY = tip ? p.historyY[older] : (y + p.historyY[older]) / 2;
      const taper = 1 - j / (length - 1);
      const alpha = visible * taper ** 1.65 * this.visibilityAt(targetX, targetY);
      const strokeWidth = p.width * (.14 + taper * .86);
      // The newest tip stays hot; older samples keep more of the strand tint.
      const shade = j < 3 ? (falling > .45 ? 1 : 2) : j < length * .42 ? 1 : 0;
      if (shade !== previousShade) {
        ctx.strokeStyle = this.strokeColor(shades[shade]);
        previousShade = shade;
      }
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.quadraticCurveTo(x, y, targetX, targetY);
      if (!this.reduced && falling > .10 && j < 14) {
        ctx.globalAlpha = alpha * falling * .30;
        ctx.lineWidth = strokeWidth * 3.15;
        ctx.stroke();
      }
      ctx.globalAlpha = alpha * (.86 + falling * .14);
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
      endX = targetX; endY = targetY;
      j += stride;
    }
    if (!this.reduced && falling > .28 && p.glint) {
      ctx.fillStyle = this.strokeColor(shades[2]);
      for (let offset = 4; offset < Math.min(length, this.mobile ? 17 : 29); offset += this.mobile ? 5 : 4) {
        const slot = (p.cursor - offset + HISTORY) % HISTORY;
        const pulse = Math.max(0, Math.sin(p.phase * 3 + offset + p.age * (12 + offset / 2))) ** 2;
        if (pulse < .25) continue;
        const x = p.historyX[slot], y = p.historyY[slot];
        ctx.globalAlpha = visible * falling * pulse * this.visibilityAt(x, y);
        ctx.beginPath();
        ctx.arc(x, y, p.width * (.42 + pulse * .67), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private shadesFor(color: LightColor) {
    let shades = this.trailShades.get(color);
    if (!shades) {
      const mix = (amount: number): LightColor => [
        Math.round(color[0] + (PEARL[0] - color[0]) * amount),
        Math.round(color[1] + (PEARL[1] - color[1]) * amount),
        Math.round(color[2] + (PEARL[2] - color[2]) * amount),
      ];
      shades = [color, mix(.31), mix(.64)];
      this.trailShades.set(color, shades);
    }
    return shades;
  }

  private strokeColor(color: LightColor) {
    let css = this.strokes.get(color);
    if (!css) {
      css = 'rgb(' + color.join(',') + ')';
      this.strokes.set(color, css);
    }
    return css;
  }

  private drawRocket(p: P5, ctx: CanvasRenderingContext2D, b: SceneBurst) {
    const progress = (this.t - b.start) / (b.delay - b.start);
    const x = this.launchX(b, progress), y = this.launchY(b, progress);
    const [r, g, blue] = b.colors[0];
    for (let i = 15; i > 0; i--) {
      const t = Math.max(0, progress - i * .014);
      const next = Math.max(0, progress - (i - 1) * .014);
      if (next <= 0) continue;
      const weight = 1 - i / 16;
      const tx = this.launchX(b, t), ty = this.launchY(b, t);
      p.stroke(r, g, blue, weight * 206 * this.visibilityAt(tx, ty));
      p.strokeWeight(.001 + weight * .003);
      p.line(tx, ty, this.launchX(b, next), this.launchY(b, next));
      if (i % 2 && !this.reduced) {
        p.noStroke();
        const [red, green, blue] = b.colors[1];
        p.fill(red, green, blue, 142 * weight * this.visibilityAt(tx, ty));
        p.circle(tx + (rnd(i + 21) - .5) * .045, ty - i * .0015, .003 + rnd(i) * .0035);
      }
    }
    this.glow.draw(ctx, x, y, .025, b.colors[1], .92 * this.visibilityAt(x, y));
  }

  private visibilityAt(x: number, y: number) {
    if (!this.faceEnvelope) return 1;
    const { x: hx, y: hy, rx, ry } = this.faceEnvelope;
    const dx = x - hx, dy = y - hy;
    const c = this.headCos, s = this.headSin;
    const distance = ((dx * c + dy * s) / rx) ** 2 + ((-dx * s + dy * c + ry * .12) / ry) ** 2;
    return .06 + .94 * ease(distance, .40, 1.37);
  }

  private launchX(b: Burst, t: number) {
    return b.startX + (b.x - b.startX) * t + Math.sin(Math.PI * t) * .12 * Math.sign(b.x);
  }

  private launchY(b: Burst, t: number) {
    return b.startY + (b.y - b.startY) * (1 - (1 - t) ** 1.35);
  }

  drawDebug(p: P5) {
    if (!this.active) return;
    p.noFill();
    p.stroke(255, 182, 112);
    p.strokeWeight(.003);
    for (const b of this.bursts) {
      p.circle(b.startX, b.startY, .034);
      p.circle(b.x, b.y, b.fired ? .066 : .035);
    }
  }
}
