import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { finishes, giftGeometry, giftMaterial, giftMotion, giftNames, studio } from './giftArt';
import './gallery.css';

const colors = ['#ffba38', '#ff397e', '#8760ff', '#22d9f1', '#ff688c', '#d6cdff', '#ffffff'];
const labels = [...giftNames, ...finishes];

export function GiftGallery() {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const replay = useRef<{ index: number; time: number } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const element = canvas.current!;
    const tiles = [...root.current!.querySelectorAll<HTMLElement>('.gift-window')];
    const mobile = matchMedia('(max-width: 640px)').matches;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let stage: ReturnType<typeof studio>;
    try { stage = studio(element, mobile); } catch { setError(true); return; }
    const { renderer, scene } = stage;
    const camera = new T.PerspectiveCamera(34, 1, .1, 20);
    camera.position.set(0, 0, 4.55);
    const geometries = giftNames.map((_, index) => giftGeometry(index, mobile));
    const meshes = labels.map((_, index) => {
      const material = giftMaterial(finishes[index < 7 ? [0, 0, 1, 2, 0, 3, 0][index] : index - 7], colors[index] ?? '#ef71b4');
      material.vertexColors = index === 6;
      if (index === 6) material.side = T.DoubleSide;
      const mesh = new T.Mesh(geometries[index < 7 ? index : 2], material);
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    });
    let frame = 0;
    let width = 0;
    let height = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || renderer.getContext().isContextLost()) return;
      if (width !== innerWidth || height !== innerHeight) {
        width = innerWidth;
        height = innerHeight;
        renderer.setSize(width, height, false);
      }
      renderer.setScissorTest(false);
      renderer.clear();
      renderer.setScissorTest(true);
      tiles.forEach((tile, index) => {
        const box = tile.getBoundingClientRect();
        if (box.bottom < 0 || box.top > height || !box.width || !box.height) return;
        renderer.setViewport(box.left, height - box.bottom, box.width, box.height);
        renderer.setScissor(box.left, height - box.bottom, box.width, box.height);
        camera.aspect = box.width / box.height;
        camera.updateProjectionMatrix();
        const mesh = meshes[index];
        const time = replay.current?.index === index ? (now - replay.current.time) / 1000 : 9;
        const motion = giftMotion(Math.min(time, 1.4));
        mesh.scale.setScalar(reduced.matches ? 1 : motion.scale);
        mesh.position.y = reduced.matches ? 0 : motion.bounce * .25;
        mesh.rotation.set(.13, reduced.matches ? .27 : .27 + Math.sin(now / 1800 + index) * .46, -.1);
        mesh.visible = true;
        renderer.render(scene, camera);
        mesh.visible = false;
      });
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      meshes.forEach(mesh => mesh.material.dispose());
      geometries.forEach(geometry => geometry.dispose());
      stage.dispose();
    };
  }, []);
  function cards(start: number, end: number) {
    return labels.slice(start, end).map((label, i) => (
      <button type="button" className="gallery-gift" key={label}
        onClick={() => { replay.current = { index: start + i, time: performance.now() }; }}>
        <span className="gift-window" aria-hidden="true" />
        <span className="gift-caption">{label}</span>
      </button>
    ));
  }
  return <main className="gift-gallery" ref={root}>
    <header><a href="./">← LIVE Preview</a><span>FACE THE MOMENT</span></header>
    <h1>3D Gift Gallery</h1>
    <p>Tap a gift to replay its entrance.</p>
    {error && <p role="alert">WebGL is unavailable on this device.</p>}
    <section aria-labelledby="gift-shapes"><h2 id="gift-shapes">Shapes</h2><div className="gallery-grid">{cards(0, 7)}</div></section>
    <section aria-labelledby="gift-finishes"><h2 id="gift-finishes">Material finishes</h2><div className="gallery-grid">{cards(7, 11)}</div></section>
    <canvas className="gallery-render" ref={canvas} aria-hidden="true" />
  </main>;
}
