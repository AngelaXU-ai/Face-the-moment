import type P5 from 'p5';
import type { FacePose } from '../face/types';
import { atmosphere, atmosphereRGB } from './atmosphericPalette';

export interface RainInput { strength: number; pose: FacePose | null }

export const rainTuning = {
  density: [32, 79],
  angleDegrees: 17,
  rainBrightness: 1.40,
  foregroundShare: .21,
  streakLengthScale: [1.41, 1.78],
  foregroundDropletSize: 1.61,
  streakHighlightIntensity: .83,
  dropletHeadBrightness: 1.10,
  ground: [.81, .94],
  rippleHorizontalRadius: [.020, .166],
  rippleScaleVariance: [.065, .41, .84],
  rippleRingCounts: [1, 2, 4],
  rippleRingSpacing: .19,
  rippleRingDelay: .095,
  rippleVerticalRatio: [.24, .39],
  rippleExpansionSeconds: 1.04,
  rippleFadeSeconds: 1.22,
  splashes: [7, 10],
  glints: [3, 4],
  microStars: [1, 2],
  lowerFieldActivity: 1.0,
  sparkleBrightness: 1.33,
  impactSpreadRadius: .112,
  impactColorVariation: .31,
  sparkleLifetime: [.62, 1.02],
  impactBrightness: 226,
  layerBrightness: [.40, .91, 1],
} as const;

const colors = [atmosphere.ice, atmosphere.teal, atmosphere.blue, atmosphere.violet, atmosphere.silver].map(atmosphereRGB);
const palePink = atmosphereRGB(atmosphere.pink);
const splashColors = [colors[0], colors[2], colors[3], colors[4], palePink];
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
function hash(n: number) { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); }
const slope = Math.tan(rainTuning.angleDegrees * Math.PI / 180);

export function rainSpawnBounds(halfWidth: number, fallDistance: number) {
  // Cover the visible top AND the upwind overscan needed to reach the right edge below.
  return { left: -halfWidth, right: halfWidth + fallDistance * (slope + .028) };
}

export class RainParty {
  private readonly drops = Array.from({length: 168}, () => ({
    x: 0, y: 0, ground: 0, age: -1, speed: 0, gravity: 0, length: 0, weight: 0, light: 0, layer: 0, color: 0,
    head: 0, highlight: 0,
  }));
  private readonly ripples = Array.from({length: 80}, () => ({
    x: 0, y: 0, age: -1, radius: 0, squash: 0, light: 0, color: 0, rings: 1,
  }));
  private readonly splash = Array.from({length: 720}, () => ({
    x: 0, y: 0, ground: 0, vx: 0, vy: 0, age: -1, delay: 0, lifetime: 0, size: 0, color: 0, tint: 0, glint: false, star: false,
  }));
  private time = 0;
  private width = 1;
  private carry = 0;
  private serial = 0;
  private dropSerial = 0;
  private strength = 0;
  private veil = 0;
  private reduced = false;
  private drift = 0;
  private face: FacePose | null = null;
  private fx = 0; private fy = 0; private rx = 1; private ry = 1; private c = 1; private s = 0;
  particleCount = 0;
  dropCount = 0;
  splashCount = 0;
  impactCount = 0;
  rippleCount = 0;

  update(dt: number, input: RainInput | null, halfWidth: number, reduced: boolean, pose = input?.pose ?? null, emitting = true) {
    if (!input && !this.particleCount && !this.rippleCount && this.veil < .012) return false;
    this.time += dt;
    this.reduced = reduced;
    this.particleCount = this.rippleCount = this.dropCount = this.splashCount = 0;
    if (halfWidth !== this.width) {
      const ratio = halfWidth / this.width;
      for (const p of this.drops) if (p.age >= 0) {
        const offset = (p.y - p.ground) * slope;
        p.x = (p.x - offset) * ratio + offset;
      }
      for (const p of this.ripples) if (p.age >= 0) p.x *= ratio;
      for (const p of this.splash) if (p.age >= 0) p.x *= ratio;
      this.width = halfWidth;
    }
    this.face = pose;
    if (this.face) {
      const {centerX, centerY, width, height, rollDegrees} = this.face;
      this.fx = (centerX * 2 - 1) * halfWidth;
      this.fy = 1 - centerY * 2;
      this.rx = Math.max(.04, width * halfWidth * 1.16);
      this.ry = Math.max(.04, height * 1.12);
      const tilt = -rollDegrees * Math.PI / 180;
      this.c = Math.cos(tilt); this.s = Math.sin(tilt);
    }
    this.veil += ((input ? 1 : 0) - this.veil) * (1 - Math.exp(-dt * 4));
    if (input && emitting) {
      this.strength += (clamp(input.strength) - this.strength) * (1 - Math.exp(-dt * 3.2));
      const [min, max] = rainTuning.density;
      this.carry += dt * (min + (max - min) * this.strength) * clamp(halfWidth / 1.1, .53, 1.18) * (reduced ? .62 : 1);
      while (this.carry >= 1) { this.spawn(); this.carry--; }
    }

    const wind = this.drift = -slope + Math.sin(this.time * .8) * .028;
    for (const drop of this.drops) {
      if (drop.age < 0) continue;
      drop.age += dt;
      const distance = (drop.speed + .5 * drop.gravity * dt) * dt;
      drop.speed += drop.gravity * dt;
      if (drop.y - distance <= drop.ground) {
        drop.x += wind * (drop.y - drop.ground);
        if (emitting && Math.abs(drop.x) <= halfWidth) this.land(drop);
        drop.age = -1;
      } else {
        drop.y -= distance;
        drop.x += wind * distance;
        this.particleCount++;
        this.dropCount++;
      }
    }
    for (const ring of this.ripples) {
      if (ring.age < 0) continue;
      ring.age += dt;
      if (ring.age >= rainTuning.rippleFadeSeconds) ring.age = -1;
      else this.rippleCount++;
    }
    const drag = Math.exp(-dt * 3.6);
    for (const speck of this.splash) {
      if (speck.age < 0) continue;
      speck.age += dt;
      if (speck.age >= speck.delay + speck.lifetime) { speck.age = -1; continue; }
      this.particleCount++;
      this.splashCount++;
      if (speck.age < speck.delay) continue;
      speck.x += speck.vx * dt;
      speck.y += speck.vy * dt;
      speck.vx *= drag;
      speck.vy = (speck.vy - (speck.glint ? .04 : .39) * dt) * drag;
      if (speck.y <= speck.ground) {
        speck.y = speck.ground;
        speck.vy = Math.abs(speck.vy) * .20;
      }
    }
    return Boolean(input) || this.particleCount > 0 || this.rippleCount > 0 || this.veil >= .012;
  }

  private spawn() {
    const drop = this.drops.find(p => p.age < 0);
    if (!drop) return;
    const n = ++this.dropSerial;
    const layer = hash(n * 3);
    drop.layer = layer < .29 ? 0 : layer > 1 - rainTuning.foregroundShare ? 2 : 1;
    drop.y = 1 + hash(n * 7) * .10;
    drop.ground = 1 - 2 * (rainTuning.ground[0] + hash(n * 11) * (rainTuning.ground[1] - rainTuning.ground[0]));
    const {left, right} = rainSpawnBounds(this.width, drop.y - drop.ground);
    const sample = (n * .61803399 + hash(n * 53) * .052) % 1;
    drop.x = left + sample * (right - left);
    drop.speed = (.83 + .24 * drop.layer + hash(n * 13) * .54) * (this.reduced ? .79 : 1);
    drop.gravity = .48 + hash(n * 17) * .50;
    const variation = hash(n * 19);
    const [short, long] = rainTuning.streakLengthScale;
    drop.length = (.065 + .043 * drop.layer + variation * .065) * (short + (long - short) * variation);
    drop.weight = .0016 + drop.layer * .001 + hash(n * 23) * .0011;
    drop.light = .72 + hash(n * 25) * .28;
    drop.color = n % colors.length;
    drop.head = drop.layer === 2 ? .68 + hash(n * 29) * .32 : drop.layer === 1 && hash(n * 31) > .62 ? .46 : 0;
    drop.highlight = drop.layer && hash(n * 37) > .73 ? .22 + hash(n * 43) * .42 : 0;
    drop.age = 0;
  }

  private land(drop: typeof this.drops[number]) {
    this.impactCount++;
    const [near, far] = rainTuning.ground;
    const depth = clamp(((1 - drop.ground) / 2 - near) / (far - near));
    const ring = this.ripples.find(p => p.age < 0);
    let radius: number = rainTuning.impactSpreadRadius;
    if (ring) {
      ring.x = drop.x; ring.y = drop.ground; ring.age = 0;
      ring.color = drop.color;
      const [small, large] = rainTuning.rippleHorizontalRadius;
      const [shallow, open] = rainTuning.rippleVerticalRatio;
      const scale = hash(this.serial * 41);
      const tier = scale < .49 ? 0 : scale < .88 ? 1 : 2;
      const spread = clamp(rainTuning.rippleScaleVariance[tier] + (depth - .5) * .13 + drop.layer * .036);
      ring.radius = (small + (large - small) * spread) *
        (this.reduced ? .85 : 1);
      ring.rings = this.reduced ? 1 : rainTuning.rippleRingCounts[tier] - Number(tier === 2 && scale < .94);
      ring.squash = shallow + (open - shallow) * depth;
      ring.light = (.51 + .17 * drop.layer + .16 * depth) * drop.light;
      radius = ring.radius;
    }
    const spray = this.reduced ? 2 : Math.round(rainTuning.splashes[0] + (rainTuning.splashes[1] - rainTuning.splashes[0]) * this.strength);
    const shimmer = this.reduced ? 1 : rainTuning.glints[this.strength > .58 && drop.layer > 0 ? 1 : 0];
    const stars = this.reduced ? 0 : rainTuning.microStars[Number(drop.layer === 2)];
    const count = Math.round((spray + shimmer + stars) * rainTuning.lowerFieldActivity);
    for (let i = 0; i < count; i++) {
      const p = this.splash.find(particle => particle.age < 0);
      if (!p) break;
      const n = ++this.serial;
      p.glint = i >= spray;
      p.star = i >= spray + shimmer;
      const side = i % 2 === 0 ? -1 : 1;
      p.x = drop.x + (p.star && i % 3 !== 0 ? side * radius * (.35 + hash(n) * .31) : 0);
      p.y = drop.ground + (p.glint ? hash(n * 5) * .009 : 0);
      p.ground = drop.ground;
      const medium = !p.glint && i % 4 === 0;
      p.vx = side * radius * (.19 + hash(n * 3) * .81) * (p.glint ? .65 : medium ? 3.05 : 1.62);
      p.vy = (p.glint ? .038 : .14) + hash(n * 7) * (p.glint ? .10 : medium ? .43 : .31);
      p.age = 0;
      p.delay = p.star ? .21 + hash(n * 15) * .19 : p.glint ? .09 + hash(n * 15) * .15 : hash(n * 17) * .055;
      const [brief, lingering] = rainTuning.sparkleLifetime;
      p.lifetime = p.glint ? brief + hash(n * 9) * (lingering - brief) : .28 + hash(n * 9) * .29;
      p.size = (medium || p.star ? .004 : .0019) + hash(n * 11) * .0031;
      p.color = drop.color;
      p.tint = p.glint && hash(n * 23) > .93 ? 4 : Math.floor(hash(n * 27) * 4);
    }
  }

  private visibility(x: number, y: number) {
    if (!this.face) return 1;
    const dx = x - this.fx, dy = y - this.fy;
    const d = ((this.c * dx + this.s * dy) / this.rx) ** 2 + ((-this.s * dx + this.c * dy) / this.ry) ** 2;
    return .12 + .88 * smooth((d - .25) / 1.6);
  }

  draw(p: P5) {
    const energy = .70 + .30 * this.strength;
    if (this.veil >= .012) {
      p.noStroke();
      for (let band = 0; band < 6; band++) {
        p.fill(132, 170, 216, this.veil * (7 - band));
        p.ellipse(Math.sin(this.time * .25 + band) * this.width * .16, 1.015, this.width * (1.9 + band * .12), .045 + band * .022);
      }
    }
    for (const drop of this.drops) {
      if (drop.age < 0) continue;
      const {x, y, length, weight, layer} = drop;
      const color = colors[drop.color];
      const alpha = 244 * energy * rainTuning.rainBrightness * drop.light * rainTuning.layerBrightness[layer] * this.visibility(x, y + length * .24);
      const tailX = x - this.drift * length;
      const jointX = x - this.drift * length * .45;
      const taperX = x - this.drift * length * .74;
      if (layer > 0) {
        p.stroke(color[0], color[1], color[2], alpha * .18);
        p.strokeWeight(weight * 2.9);
        p.line(x, y, jointX, y + length * .45);
      }
      p.stroke(color[0], color[1], color[2], alpha * .18);
      p.strokeWeight(weight * .39);
      p.line(tailX, y + length, taperX, y + length * .74);
      p.stroke(color[0], color[1], color[2], alpha * .47);
      p.strokeWeight(weight * .61);
      p.line(taperX, y + length * .74, jointX, y + length * .45);
      p.stroke(color[0], color[1], color[2], alpha);
      p.strokeWeight(weight);
      p.line(jointX, y + length * .45, x, y);
      if (drop.head) {
        p.noStroke();
        p.push();
        p.translate(x, y);
        p.rotate(Math.atan(this.drift));
        const size = weight * rainTuning.foregroundDropletSize;
        p.fill(color[0], color[1], color[2], alpha * drop.head * .39);
        p.ellipse(0, size * .75, size * 1.43, size * (3.2 + drop.head * 2.1));
        p.fill(232, 249, 255, alpha * drop.head * .92 * rainTuning.dropletHeadBrightness);
        p.ellipse(-size * .16, size * .13, size * .78, size * 1.74);
        p.pop();
      }
      if (drop.highlight && !this.reduced) {
        const glintY = length * drop.highlight;
        const glintX = x - this.drift * glintY;
        p.stroke(226, 246, 255, alpha * rainTuning.streakHighlightIntensity * (.68 + .32 * Math.sin(drop.age * 9) ** 2));
        p.strokeWeight(weight * .58);
        p.line(glintX, y + glintY, glintX - this.drift * length * .09, y + glintY + length * .09);
        if (layer === 2 && drop.highlight > .51) {
          const gleam = smooth((Math.sin(drop.age * 6 + drop.highlight * 20) - .72) / .28);
          if (gleam > .08) {
            p.noStroke();
            p.fill(225, 247, 255, alpha * gleam * .40);
            p.circle(glintX, y + glintY, weight * 1.55);
          }
        }
      }
    }
    for (const ring of this.ripples) {
      if (ring.age < 0) continue;
      const {x, y, age, radius, squash, light} = ring;
      const color = colors[ring.color];
      const t = clamp(age / rainTuning.rippleExpansionSeconds);
      const r = radius * (.12 + .88 * (1 - (1 - t) ** 1.7));
      const alpha = rainTuning.impactBrightness * light * energy * (1 - smooth(age / rainTuning.rippleFadeSeconds));
      p.noFill();
      p.stroke(color[0], color[1], color[2], alpha * .18);
      p.strokeWeight(.008);
      p.ellipse(x, y, 2 * r, 2 * r * squash);
      p.stroke(color[0], color[1], color[2], alpha);
      p.strokeWeight(.0025);
      p.ellipse(x, y, 2 * r, 2 * r * squash);
      if (ring.rings > 1) {
        p.strokeWeight(.0015);
        for (let i = 1; i < ring.rings; i++) {
          const lag = age - i * rainTuning.rippleRingDelay;
          if (lag <= 0) break;
          const echo = clamp(lag / rainTuning.rippleExpansionSeconds);
          const inner = radius * (1 - rainTuning.rippleRingSpacing * i) * (.12 + .88 * (1 - (1 - echo) ** 1.7));
          p.stroke(215, 238, 253, alpha * (.62 - i * .11) * smooth(lag / .13));
          p.ellipse(x, y, 2 * inner, 2 * inner * squash);
        }
        if (t > .13) {
          p.stroke(218, 244, 255, alpha * .34);
          p.arc(x, y, 2 * r, 2 * r * squash, .24, 1.62);
        }
      }
      if (age < .19) {
        const flash = alpha * (1 - smooth(age / .19));
        p.noStroke();
        p.fill(color[0], color[1], color[2], flash * .26);
        p.circle(x, y, .026);
        p.fill(232, 249, 255, flash * 1.4);
        p.circle(x, y, .009);
      }
    }
    for (const speck of this.splash) {
      if (speck.age < speck.delay) continue;
      const color = colors[speck.color];
      const tint = splashColors[speck.tint];
      const mix = rainTuning.impactColorVariation * (speck.glint ? 1 : .68);
      const red = color[0] + (tint[0] - color[0]) * mix;
      const green = color[1] + (tint[1] - color[1]) * mix;
      const blue = color[2] + (tint[2] - color[2]) * mix;
      const phase = (speck.age - speck.delay) / speck.lifetime;
      const alpha = 192 * energy * this.visibility(speck.x, speck.y) * (1 - smooth(phase)) *
        (speck.glint ? smooth(phase * 7) * rainTuning.sparkleBrightness : 1);
      p.noStroke();
      p.fill(red, green, blue, alpha * .33);
      p.circle(speck.x, speck.y, speck.size * 2.7);
      p.fill(221, 243, 255, alpha);
      p.ellipse(speck.x, speck.y, speck.size, speck.size * (speck.glint ? 1 : 1.55));
      if (speck.glint && !this.reduced) {
        const twinkle = .55 + .45 * Math.sin(phase * 9 + speck.size * 1000) ** 2;
        const arm = (.009 + speck.size * 1.15) * (.65 + phase * .35) * (speck.star ? 1.35 : .83);
        p.stroke(red, green, blue, alpha * twinkle * .68);
        p.strokeWeight(.0014);
        p.line(speck.x - arm * .60, speck.y, speck.x + arm * .60, speck.y);
        p.line(speck.x, speck.y - arm, speck.x, speck.y + arm);
      }
    }
  }

  drawDebug(p: P5) {
    p.noFill(); p.stroke(96, 248, 207); p.strokeWeight(.0025);
    for (const depth of rainTuning.ground) p.line(-this.width, 1 - depth * 2, this.width, 1 - depth * 2);
    const {left, right} = rainSpawnBounds(this.width, 1.10 - (1 - rainTuning.ground[1] * 2));
    p.stroke(255, 202, 126);
    p.line(left + .006, .99, Math.min(right, this.width) - .006, .99);
    p.line(left + .006, .99, left + .006, -.99);
    p.line(this.width - .006, .99, this.width - .006, -.99);
    for (const ring of this.ripples) if (ring.age >= 0 && ring.age < .24) p.circle(ring.x, ring.y, .027);
  }

  restart() { this.carry = 0; this.impactCount = 0; }

  clear() {
    this.restart();
    this.veil = this.strength = this.particleCount = this.rippleCount = this.dropCount = this.splashCount = 0;
    this.face = null;
    for (const p of this.drops) p.age = -1;
    for (const p of this.ripples) p.age = -1;
    for (const p of this.splash) p.age = -1;
  }
}
