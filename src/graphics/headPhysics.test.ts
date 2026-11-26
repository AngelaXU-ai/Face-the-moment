import { describe, expect, it } from 'vitest';
import { mapGeometryThroughCover } from '../face/faceGeometry';
import { CollisionCombo, countContact, HeadCollider, projectHead } from './headPhysics';

const pose = {centerX: .5, centerY: .5, width: .4, height: .3, rollDegrees: 0, velocityX: 0, velocityY: 0, speed: 0};
function setup() {
  const head = new HeadCollider();
  head.update(pose, .56, 1 / 60);
  return head;
}

describe('head collision', () => {
  it('reflects against a static head and retains damped tangent velocity', () => {
    const head = setup();
    const velocity = {x: .4, y: -1};
    const to = {x: head.x, y: head.y + .02};
    const hit = head.solve({x: head.x, y: head.y + .5}, to, velocity, .03)!;
    expect(hit.ny).toBeCloseTo(1);
    expect(velocity.x).toBeCloseTo(.36);
    expect(velocity.y).toBeCloseTo(.68);
    expect(to.y).toBeGreaterThan(head.y + head.ry + .03);
  });

  it('transfers smoothed head movement to the rebound', () => {
    const head = setup();
    for (let i = 1; i < 8; i++) head.update({...pose, centerX: .5 + i * .014}, .56, 1 / 60);
    const velocity = {x: 0, y: -1};
    const contact = head.solve({x: head.x, y: head.y + .5}, {x: head.x, y: head.y + .02}, velocity, .02);
    expect(contact).not.toBeNull();
    expect(velocity.x).toBeGreaterThan(0);
    expect(Math.hypot(velocity.x, velocity.y)).toBeLessThanOrEqual(2.3);
  });

  it('ignores face-height crossings, the underside, and outgoing particles', () => {
    const head = setup();
    for (const y of [0, .15, .29]) {
      const to = {x: -.5, y};
      expect(head.solve({x: .5, y}, to, {x: -1, y: 0}, .03)).toBeNull();
      expect(to).toEqual({x: -.5, y});
    }
    const to = {x: head.x, y: head.y + head.ry * .5};
    expect(head.solve({x: head.x, y: .17}, to, {x: 0, y: 1}, .02)).toBeNull();
    expect(head.solve(to, {...to}, {x: 0, y: 1}, .02)).toBeNull();
  });

  it('slides off the rotated upper arc and scales it with tracked head size', () => {
    const head = setup();
    head.update({...pose, centerY: .46, width: .48, height: .35, rollDegrees: 28}, .56, 1);
    const c = Math.cos(head.angle), s = Math.sin(head.angle);
    const position = (x: number, y: number) => ({x: head.x + x * c - y * s, y: head.y + x * s + y * c});
    expect(head.rx).toBeGreaterThan(.4 * .56 * .86);
    expect(head.ry).toBeGreaterThan(.3 * .46);
    const velocity = {x: s, y: -c};
    const x = head.rx * .6;
    const hit = head.solve(position(x, head.ry * 2), position(x, -.04), velocity, 0)!;
    expect(hit.nx * c + hit.ny * s).toBeGreaterThan(0);
    expect(hit.ny * c - hit.nx * s).toBeGreaterThan(0);
    expect(velocity.x * c + velocity.y * s).toBeGreaterThan(0);
  });

  it('sweeps a fast crossing with both endpoints outside and disables after face loss', () => {
    const head = setup();
    const from = {x: head.x, y: 1};
    const velocity = {x: 0, y: -25};
    expect(head.solve(from, {x: head.x, y: -1}, velocity, .02)?.ny).toBeCloseTo(1);
    expect(velocity.y).toBeCloseTo(2.3);
    head.update(null, .56, .016);
    expect(head.solve(from, {x: -1, y: head.y}, velocity, .02)).toBeNull();
  });

  it('requires separation and cooldown and expires combo hits after three seconds', () => {
    const gate = {inside: false, lastHit: -Infinity};
    expect(countContact(gate, true, true, 0)).toBe(true);
    expect(countContact(gate, true, true, .3)).toBe(false);
    countContact(gate, false, false, .31);
    expect(countContact(gate, true, true, .32)).toBe(true);
    countContact(gate, false, false, .33);
    expect(countContact(gate, true, true, .4)).toBe(false);
    const combo = new CollisionCombo();
    const awards = Array.from({length: 20}, (_, i) => combo.hit(i * .01)).filter(Boolean);
    expect(awards).toEqual([3, 5, 10, 15, 20]);
    combo.advance(3.21);
    expect(combo.count).toBe(0);
  });

  it('maps mirrored cover coordinates, roll and dimensions through viewport resizing', () => {
    const source = {sourceWidth: 1280, sourceHeight: 720};
    const face = {centerX: .56, centerY: .48, width: .15, height: .31, rollRadians: .2};
    const project = (width: number, height: number, mirror: boolean) => projectHead({
      ...pose, ...mapGeometryThroughCover(face, {...source, viewportWidth: width, viewportHeight: height, mirror}),
    }, width / height);
    const a = project(360, 640, false);
    const b = project(360, 640, true);
    expect(b.x).toBeCloseTo(-a.x);
    expect(b.angle).toBeCloseTo(-a.angle);
    expect(project(720, 1280, false)).toEqual(a);
    expect(project(430, 640, false).rx).toBeCloseTo(a.rx);
    expect(project(430, 640, false).x).toBeCloseTo(a.x);
  });
});
