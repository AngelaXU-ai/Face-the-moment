import { useState } from 'react';
import { EffectPreview } from './EffectPreview';
import type { EffectRequest } from './EffectManager';
import { fireworkShapes, fireworkThemes, type FireworkShape, type FireworkTheme } from './FireworkEmitter';
import './gallery.css';

export function FireworkPreview() {
  const [shape, setShape] = useState<FireworkShape>('SPHERE');
  const [theme, setTheme] = useState<FireworkTheme>('Candy');
  const [intensity, setIntensity] = useState(85);
  const [reduced, setReduced] = useState(false);
  const [command, setCommand] = useState<EffectRequest | null>(null);
  const launch = (selected: FireworkShape) => {
    setShape(selected);
    setCommand({ kind: 'firework', source: 'manual', settings: { shape: selected, theme, strength: intensity / 100, reduced } });
  };
  return <main className="gift-gallery firework-preview">
    <header><a href="./">← LIVE Preview</a><span>FACE THE MOMENT</span></header>
    <h1>Firework Party</h1>
    <div className="firework-layout">
      <div className="firework-stage" aria-label="Firework preview stage">
        <EffectPreview request={command} pose={null} />
      </div>
      <section className="firework-controls" aria-label="Firework settings">
        <h2>Choose a shape</h2>
        <div className="firework-shapes">{fireworkShapes.map(item => <button key={item} type="button" aria-pressed={shape === item} onClick={() => launch(item)}>{item}</button>)}</div>
        <label>Theme<select value={theme} onChange={event => setTheme(event.target.value as FireworkTheme)}>
          {Object.keys(fireworkThemes).map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Intensity · {intensity}%<input type="range" min="10" max="100" value={intensity} onChange={event => setIntensity(Number(event.target.value))} /></label>
        <label className="firework-reduced"><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} /> Reduced Motion</label>
        <button type="button" className="primary-action" onClick={() => launch(shape)}>Replay {shape}</button>
      </section>
    </div>
  </main>;
}
