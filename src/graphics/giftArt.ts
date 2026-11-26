import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const giftNames = ['Rounded Star', 'Inflated Heart', 'Candy Sphere', 'Jelly Droplet', 'Curved Ribbon', 'Puffy Cloud', 'Rainbow Arch'] as const;
export const finishes = ['Candy Gloss', 'Pearlescent', 'Jelly', 'Soft Plastic'] as const;
export type Finish = typeof finishes[number];

export function giftMaterial(finish: Finish, color: T.ColorRepresentation) {
  const profiles = {
    'Candy Gloss': { roughness: .26, metalness: .12, clearcoat: 1, clearcoatRoughness: .17 },
    Pearlescent: { roughness: .32, metalness: .28, clearcoat: .72, clearcoatRoughness: .24, iridescence: .36 },
    Jelly: { roughness: .23, metalness: 0, clearcoat: 1, clearcoatRoughness: .15, transparent: true, opacity: .84 },
    'Soft Plastic': { roughness: .44, metalness: .02, clearcoat: .38, clearcoatRoughness: .34 },
  };
  return new T.MeshPhysicalMaterial({ color, envMapIntensity: .85, ...profiles[finish] });
}

function rounded(shape: T.Shape, bevel: number) {
  const geometry = new T.ExtrudeGeometry(shape, {
    depth: bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 8, curveSegments: 24,
  });
  geometry.center();
  return geometry;
}

export function giftGeometry(index: number, mobile: boolean) {
  const detail = mobile ? 32 : 56;
  const shape = new T.Shape();
  if (index === 0) {
    const points = Array.from({ length: 10 }, (_, i) => {
      const a = Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 ? .43 : .84;
      return new T.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    });
    shape.moveTo(...points[9].clone().lerp(points[0], .78).toArray());
    points.forEach((p, i) => {
      const next = points[(i + 1) % 10];
      const out = p.clone().lerp(next, .22);
      shape.quadraticCurveTo(p.x, p.y, out.x, out.y);
      const end = p.clone().lerp(next, .78);
      shape.lineTo(end.x, end.y);
    });
    return rounded(shape, .14);
  }
  if (index === 1) {
    shape.moveTo(0, -.68);
    shape.bezierCurveTo(-.28, -.48, -.81, -.12, -.77, .28);
    shape.bezierCurveTo(-.74, .69, -.22, .81, 0, .46);
    shape.bezierCurveTo(.22, .81, .74, .69, .77, .28);
    shape.bezierCurveTo(.81, -.12, .28, -.48, 0, -.68);
    return rounded(shape, .16);
  }
  if (index === 2) return new T.SphereGeometry(.72, detail, detail / 2);
  if (index === 3) {
    const profile = new T.CubicBezierCurve(new T.Vector2(0, -.75), new T.Vector2(1.55, -.75), new T.Vector2(.18, .38), new T.Vector2(0, .93));
    return new T.LatheGeometry(profile.getPoints(detail), detail);
  }
  if (index === 4) {
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(-.75, -.38, .12), new T.Vector3(-.42, .38, -.22),
      new T.Vector3(.02, .05, .34), new T.Vector3(.42, -.24, -.22), new T.Vector3(.77, .44, 0),
    ]);
    const tube = new T.TubeGeometry(curve, detail, .19, 16);
    const positions = tube.attributes.position;
    for (let i = 0; i <= detail; i++) {
      const center = curve.getPointAt(i / detail);
      const taper = Math.max(.09, Math.min(1, i / 5, (detail - i) / 5));
      for (let j = 0; j <= 16; j++) {
        const k = i * 17 + j;
        positions.setXYZ(k, center.x + (positions.getX(k) - center.x) * taper,
          center.y + (positions.getY(k) - center.y) * taper,
          center.z + (positions.getZ(k) - center.z) * taper * .52);
      }
    }
    tube.computeVertexNormals();
    return tube;
  }
  if (index === 5) {
    shape.moveTo(-.68, -.41);
    shape.bezierCurveTo(-1.02, -.38, -.97, .25, -.55, .24);
    shape.bezierCurveTo(-.58, .65, -.03, .81, .18, .45);
    shape.bezierCurveTo(.43, .59, .66, .37, .64, .18);
    shape.bezierCurveTo(1.04, .16, 1.02, -.41, .61, -.44);
    shape.bezierCurveTo(.12, -.49, -.36, -.48, -.68, -.41);
    return rounded(shape, .16);
  }
  const arch = new T.TorusGeometry(.59, .33, 24, detail, Math.PI);
  const colors = [];
  const palette = ['#aa76ff', '#59caff', '#70f3a6', '#ffdb58', '#ff74ac'].map(c => new T.Color(c));
  const pos = arch.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const p = (Math.hypot(pos.getX(i), pos.getY(i)) - .26) / .66;
    const band = Math.min(4, Math.max(0, Math.floor(p * 5)));
    colors.push(...palette[band].toArray());
    pos.setXYZ(i, pos.getX(i), pos.getY(i) - .42, pos.getZ(i) * .62);
  }
  arch.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  // Close both ends of the full-depth arch.
  const caps = [1, -1].map(side => {
    const cap = new T.CircleGeometry(.33, 24);
    cap.scale(1, .62, 1);
    cap.rotateX(Math.PI / 2);
    cap.translate(side * .59, -.42, 0);
    const colors = [];
    for (let i = 0; i < cap.attributes.position.count; i++) {
      const p = (Math.abs(cap.attributes.position.getX(i)) - .26) / .66;
      colors.push(...palette[Math.min(4, Math.max(0, Math.floor(p * 5)))].toArray());
    }
    cap.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    return cap;
  });
  const closed = mergeGeometries([arch, ...caps]);
  [arch, ...caps].forEach(g => g.dispose());
  return closed;
}

export function studio(canvas: HTMLCanvasElement, mobile: boolean) {
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, premultipliedAlpha: true });
  renderer.setClearColor(0, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.75));
  const scene = new T.Scene();
  const booth = new T.Scene();
  booth.background = new T.Color(.16, .16, .16);
  const panel = new T.PlaneGeometry(1, 1);
  const softboxes: T.MeshBasicMaterial[] = [];
  for (const [x, y, z, w, h, tint] of [
    [-3, 4, 5, 5, 3, '#fff1ef'], [4, 1, 2, 2, 5, '#d9eeff'], [0, 4, -4, 5, 2, '#ffbdeb'],
  ] as const) {
    const material = new T.MeshBasicMaterial({ color: new T.Color(tint).multiplyScalar(3), side: T.DoubleSide });
    softboxes.push(material);
    const mesh = new T.Mesh(panel, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, 1);
    mesh.lookAt(0, 0, 0);
    booth.add(mesh);
  }
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(booth, .055, .1, 20, { size: mobile ? 64 : 128 });
  pmrem.dispose();
  panel.dispose();
  softboxes.forEach(material => material.dispose());
  scene.environment = environment.texture;
  scene.add(new T.HemisphereLight(0xf5e4ff, 0x443060, 1.05));
  const key = new T.DirectionalLight(0xfff2df, 2.2);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new T.DirectionalLight(0xb4ceff, 1.6);
  rim.position.set(3, 2, -3);
  scene.add(rim);
  return { renderer, scene, dispose() { environment.dispose(); renderer.dispose(); } };
}

export function giftMotion(t: number) {
  const p = Math.min(1, Math.max(0, t / .54));
  const back = 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
  const elastic = Math.sin(t * 14) * Math.exp(-t * 4);
  const dissolve = Math.min(1, Math.max(0, (t - 1.85) / .65));
  return { scale: Math.max(0, back + .12 * elastic) * (1 - dissolve ** 2), bounce: elastic, spread: 1 - Math.exp(-3 * t) };
}
