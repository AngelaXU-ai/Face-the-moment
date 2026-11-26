import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraStatus } from '../camera/useCamera';
import { useCamera } from '../camera/useCamera';
import { useFaceTracking } from '../face/useFaceTracking';
import type { EffectRequest, ExpressionEffect } from '../graphics/EffectManager';
import { EffectPreview, type PhysicsDebugSample } from '../graphics/EffectPreview';
import { COMBO_REWARDS, type ComboThreshold } from '../graphics/headPhysics';
import { Icon } from '../ui/Icon';
import { firstTutorialStep, liveTutorialKey, LiveTutorial } from '../ui/LiveTutorial';
import { FireworkAudio } from '../graphics/FireworkAudio';
import { RainAudio } from '../graphics/RainAudio';
import rainArt from '../assets/effects/rain.svg';
import fireworkArt from '../assets/effects/firework.svg';
import candyArt from '../assets/effects/candy.svg';
import starArt from '../assets/effects/star.svg';
import heartArt from '../assets/effects/heart.svg';
import galaxyArt from '../assets/effects/galaxy.svg';
import butterflyArt from '../assets/effects/butterfly.svg';

const activeGifts = [
  { id: 'rain', name: 'Rain Aura', icon: rainArt },
  { id: 'firework', name: 'Firework Party', icon: fireworkArt },
] as const;
type ActiveEffect = typeof activeGifts[number]['id'];
const placeholders = [
  { id: 'candy', name: 'Candy Burst', icon: candyArt },
  { id: 'star', name: 'Star Bloom', icon: starArt },
  { id: 'heart', name: 'Heart Pop', icon: heartArt },
  { id: 'galaxy', name: 'Galaxy Spin', icon: galaxyArt },
  { id: 'butterfly', name: 'Butterfly Bloom', icon: butterflyArt },
];

type TriggerEvent = { id: number; label: string; detail: string };

function cameraStatusLabel(status: CameraStatus): string {
  if (status === 'active') return 'Camera on';
  if (status === 'requesting') return 'Requesting access';
  if (status === 'denied') return 'Permission denied';
  if (status === 'error') return 'Camera error';
  return 'Camera off';
}

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoShellRef = useRef<HTMLDivElement>(null);
  const cameraButtonRef = useRef<HTMLButtonElement>(null);
  const giftRailRef = useRef<HTMLElement>(null);
  const debugRef = useRef<HTMLDetailsElement>(null);
  const { status: cameraStatus, error: cameraError, start, stop } = useCamera(videoRef);
  const [mirror, setMirror] = useState(true);
  const [autoTrigger, setAutoTrigger] = useState(true);
  const [rainAudio] = useState(() => new RainAudio());
  const [rainSound, setRainSound] = useState(true);
  const [rainAudioError, setRainAudioError] = useState(false);
  useEffect(() => () => rainAudio.dispose(), [rainAudio]);
  const [intensity, setIntensity] = useState(72);
  const [reduced, setReduced] = useState(false);
  const [fireworkAudio] = useState(() => new FireworkAudio());
  const [fireworkSound, setFireworkSound] = useState(true);
  const [fireworkVolume, setFireworkVolume] = useState(48);
  const [fireworkAudioError, setFireworkAudioError] = useState(false);
  useEffect(() => {
    void fireworkAudio.preload();
    return () => fireworkAudio.dispose();
  }, [fireworkAudio]);
  const [combo, setCombo] = useState<number | null>(null);
  const [reward, setReward] = useState<ComboThreshold | null>(null);
  const [showPhysics, setShowPhysics] = useState(false);
  const [physics, setPhysics] = useState<PhysicsDebugSample | null>(null);
  const receiveCombo = useCallback((count: number, milestone: ComboThreshold | null) => {
    setCombo(count);
    setReward(milestone);
  }, []);
  const [selectedEffect, setSelectedEffect] = useState<ActiveEffect>('rain');
  const [effectRequest, setEffectRequest] = useState<EffectRequest | null>(null);
  const [effectReset, setEffectReset] = useState(0);
  const [events, setEvents] = useState<TriggerEvent[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(firstTutorialStep);
  const [entering, setEntering] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!entering) return;
    const timeout = window.setTimeout(() => setEntering(false), 1000);
    return () => window.clearTimeout(timeout);
  }, [entering]);
  const finishTutorial = () => {
    try { localStorage.setItem(liveTutorialKey, 'seen'); } catch { /* Storage can be unavailable. */ }
    setTutorialStep(null);
  };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenIdle, setFullscreenIdle] = useState(false);
  const fullscreenTimer = useRef<number | undefined>(undefined);
  const fullscreenEntry = useRef<HTMLButtonElement>(null);
  const fullscreenExit = useRef<HTMLButtonElement>(null);
  const wasFullscreen = useRef(false);
  const faceTracking = useFaceTracking({
    videoRef,
    viewportRef: videoShellRef,
    active: cameraStatus === 'active',
    mirror,
  });

  const stageEffectName = selectedEffect === 'firework' ? 'Firework Party' : 'Rain Aura';

  const logEvent = useCallback((label: string, detail: string) => {
    setEvents((current) => [{ id: Date.now(), label, detail }, ...current].slice(0, 5));
  }, []);

  const unlockRainSound = useCallback(() => {
    if (!rainSound || (rainAudio.status !== 'off' && rainAudio.status !== 'paused')) return;
    void rainAudio.enable().then(enabled => setRainAudioError(!enabled));
  }, [rainAudio, rainSound]);

  const unlockFireworkSound = useCallback(() => {
    void fireworkAudio.unlock().then(ready => setFireworkAudioError(!ready));
  }, [fireworkAudio]);

  const handleStartCamera = useCallback(async () => {
    unlockRainSound();
    unlockFireworkSound();
    if (await start()) logEvent('Camera started', 'Local stream only');
  }, [logEvent, start, unlockFireworkSound, unlockRainSound]);

  const handleStopCamera = useCallback(() => {
    stop();
    logEvent('Camera stopped', 'Tracks released');
  }, [logEvent, stop]);

  const preview = useCallback((effect: ActiveEffect) => {
    if (effect === 'firework') unlockFireworkSound();
    else unlockRainSound();
    setEffectRequest({ kind: effect, source: 'manual', settings: { shape: 'SPHERE', theme: 'Candy', strength: intensity / 100, reduced } });
    logEvent(effect === 'firework' ? 'Firework Party' : 'Rain Aura', effect === 'firework' ? 'Manual preview' : `Manual preview · ${intensity}%`);
  }, [intensity, logEvent, reduced, unlockFireworkSound, unlockRainSound]);

  const sample = faceTracking.sample;
  const scores = sample?.scores;
  const smileStrength = scores ? (scores.smileLeft + scores.smileRight) / 2 : 0;
  const laughStrength = scores ? Math.min(1, (smileStrength * .65 + scores.jawOpen * .35) * intensity / 78) : 0;
  const automatic: ExpressionEffect | null = autoTrigger && cameraStatus === 'active' && sample?.pose &&
    (sample.state === 'SMILE' || sample.state === 'LAUGH') ? {
      sampleTime: sample.timestampMs,
      request: {
        kind: sample.state === 'SMILE' ? 'rain' : 'firework', source: 'expression',
        settings: { shape: 'SPHERE', theme: 'Candy', strength: sample.state === 'SMILE' ? smileStrength : laughStrength, reduced },
      },
    } : null;
  const onEffectStart = useCallback((request: EffectRequest) => {
    setSelectedEffect(request.kind);
    if (request.source === 'expression') {
      if (request.kind === 'firework') logEvent('Laugh detected', 'Firework Party');
      else logEvent('Smile detected', `Rain Aura · score ${request.settings.strength.toFixed(2)}`);
    }
  }, [logEvent]);

  const toggleMirror = useCallback(() => {
    setMirror((current) => {
      logEvent('Mirror changed', current ? 'Off' : 'On');
      return !current;
    });
  }, [logEvent]);

  const toggleFullscreen = useCallback(async () => {
    try {
      const stage = stageRef.current;
      if (!stage) return;
      if (document.fullscreenElement === stage) await document.exitFullscreen();
      else if (stage.requestFullscreen) await stage.requestFullscreen();
      else logEvent('Fullscreen unavailable', 'This browser does not support stage fullscreen');
    } catch {
      logEvent('Fullscreen unavailable', 'Browser blocked the request');
    }
  }, [logEvent]);

  const wakeFullscreenControls = useCallback(() => {
    if (document.fullscreenElement !== stageRef.current) return;
    setFullscreenIdle(false);
    window.clearTimeout(fullscreenTimer.current);
    fullscreenTimer.current = window.setTimeout(() => setFullscreenIdle(true), 3200);
  }, []);

  const reset = useCallback(() => {
    setEffectReset(value => value + 1);
    setCombo(null);
    setReduced(false);
    setMirror(true);
    setAutoTrigger(true);
    setIntensity(72);
    setSelectedEffect('rain');
    setEffectRequest(null);
    setEvents([]);
  }, []);

  useEffect(() => {
    const onFullscreen = () => {
      const active = document.fullscreenElement === stageRef.current;
      setIsFullscreen(active);
      window.clearTimeout(fullscreenTimer.current);
      setFullscreenIdle(false);
      if (active) wakeFullscreenControls();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.clearTimeout(fullscreenTimer.current);
    };
  }, [wakeFullscreenControls]);

  useEffect(() => {
    if (isFullscreen) fullscreenExit.current?.focus({ preventScroll: true });
    else if (wasFullscreen.current) fullscreenEntry.current?.focus({ preventScroll: true });
    wasFullscreen.current = isFullscreen;
  }, [isFullscreen]);

  const focusCamera = () => cameraButtonRef.current?.focus();
  const focusEffects = () => giftRailRef.current?.scrollIntoView({ behavior: 'smooth' });
  const openDebug = () => {
    setDrawerOpen(true);
    if (debugRef.current) debugRef.current.open = true;
  };

  return (
    <div className={entering ? "live-app is-entering" : "live-app"} inert={entering && tutorialStep !== null}>
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="project-logo">
          <span className="project-mark" aria-hidden="true"><i /><b /></span>
          <span>FACE THE<br />MOMENT</span>
        </div>
        <nav>
          <button className="nav-item is-active" type="button" aria-current="page"><Icon name="live" /><span>LIVE</span></button>
          <button className="nav-item" type="button" onClick={focusCamera}><Icon name="camera" /><span>Go LIVE</span></button>
          <button className="nav-item" type="button" onClick={focusEffects}><Icon name="sparkles" /><span>Effects</span></button>
          <button className="nav-item" type="button" onClick={openDebug}><Icon name="tools" /><span>Creator Tools</span></button>
        </nav>
        <div className="sidebar-note"><span>Concept Demo</span></div>
      </aside>

      <main className="main-live">
        <header className="live-header">
          <div className="mobile-brand"><span className="project-mark" aria-hidden="true"><i /><b /></span> FTM</div>
          <div className="header-title"><span className="live-pill">LIVE</span><div><strong>LIVE Preview</strong><small>Expression-driven effects studio</small></div></div>
          <div className={`camera-status camera-status-${cameraStatus}`}><i /><span>{cameraStatusLabel(cameraStatus)}</span></div>
          <span className="concept-label">Concept Demo</span>
        </header>

        <section className={`stage-area${fullscreenIdle ? ' fullscreen-idle' : ''}`} ref={stageRef}
          aria-label="Live preview stage" onPointerMove={wakeFullscreenControls}
          onPointerDown={wakeFullscreenControls} onKeyDown={wakeFullscreenControls}
          onFocusCapture={wakeFullscreenControls}>
          <div className={`video-shell ${mirror ? 'is-mirrored' : ''}`} ref={videoShellRef}>
            <video ref={videoRef} className="camera-video" playsInline muted aria-label="Local camera preview" />
            <EffectPreview
              mirror={mirror}
              request={effectRequest}
              resetVersion={effectReset}
              automatic={automatic}
              onStart={onEffectStart}
              rainAudio={rainAudio}
              fireworkAudio={fireworkAudio}
              onCollision={receiveCombo}
              debug={showPhysics}
              expression={faceTracking.sample?.state ?? 'NO_FACE'}
              onPhysicsDebug={setPhysics}
              pose={cameraStatus === 'active' ? faceTracking.sample?.pose ?? null : null}
            />
            {import.meta.env.DEV && showPhysics && cameraStatus === 'active' && faceTracking.sample?.pose && physics && (
              <svg className="physics-overlay" viewBox={`${-physics.width} -1 ${2 * physics.width} 2`} aria-hidden="true">
                <path d={`M ${physics.x - physics.rx} ${-physics.y} A ${physics.rx} ${physics.ry} 0 0 1 ${physics.x + physics.rx} ${-physics.y}`}
                  transform={`rotate(${-physics.angle * 180 / Math.PI} ${physics.x} ${-physics.y})`} />
                {physics.contact && <>
                  <circle cx={physics.contact.x} cy={-physics.contact.y} r=".017" />
                  <line x1={physics.contact.x} y1={-physics.contact.y}
                    x2={physics.contact.x + physics.contact.nx * .16} y2={-physics.contact.y - physics.contact.ny * .16} />
                </>}
              </svg>
            )}
            {faceTracking.sample?.pose && (
              <div
                className={`face-tracker face-tracker-${faceTracking.sample.state.toLowerCase()}`}
                style={{
                  left: `${faceTracking.sample.pose.centerX * 100}%`,
                  top: `${faceTracking.sample.pose.centerY * 100}%`,
                  width: `${faceTracking.sample.pose.width * 100}%`,
                  height: `${faceTracking.sample.pose.height * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${faceTracking.sample.pose.rollDegrees}deg)`,
                }}
                aria-hidden="true"
              />
            )}
            {cameraStatus !== 'active' && (
              <div className="camera-empty">
                <div className="empty-camera-icon"><Icon name="camera" size={28} /></div>
                <strong>Ready for your camera</strong>
                <p>Video stays on this device and is never uploaded.</p>
                <button ref={cameraButtonRef} className="primary-action" type="button" onClick={handleStartCamera} disabled={cameraStatus === 'requesting'}>
                  <Icon name="camera" size={20} /> {cameraStatus === 'requesting' ? 'Requesting…' : 'Start Camera'}
                </button>
                {cameraError && <p className="camera-error" role="alert">{cameraError}</p>}
              </div>
            )}
            <div className="preview-meta"><span><i className={cameraStatus === 'active' ? 'dot-live' : ''} /> {cameraStatus === 'active' ? 'LOCAL CAMERA' : 'PREVIEW'}</span><span>{stageEffectName}</span></div>
            {isFullscreen && <>
              <div className="fullscreen-scrim" aria-hidden="true" />
              <div className="fullscreen-hud">
                <div className="fullscreen-title">
                  <span className="fullscreen-live"><i /> LIVE</span>
                  <strong>{stageEffectName}</strong>
                </div>
                <div className="fullscreen-status" role="group" aria-label="Fullscreen controls">
                  <span className={`fullscreen-camera fullscreen-camera-${cameraStatus}`}><i /> {cameraStatusLabel(cameraStatus)}</span>
                  <button type="button" className="fullscreen-auto" role="switch" aria-label="Auto Trigger"
                    aria-checked={autoTrigger} onClick={() => setAutoTrigger(value => !value)}>
                    <Icon name="sparkles" size={20} /><span>Auto</span><i aria-hidden="true" />
                  </button>
                  <button ref={fullscreenExit} type="button" className="control-button fullscreen-exit"
                    aria-label="Exit fullscreen" title="Exit fullscreen (Esc)" onClick={toggleFullscreen}>
                    <Icon name="minimize" size={20} />
                  </button>
                </div>
              </div>
            </>}
            <div className="stage-controls" aria-label="Camera controls">
              {cameraStatus === 'active' ? (
                <button type="button" className="control-button stop-button" onClick={handleStopCamera} title="Stop camera"><Icon name="cameraOff" /><span>Stop</span></button>
              ) : (
                <button type="button" className="control-button" onClick={handleStartCamera} disabled={cameraStatus === 'requesting'} title="Start camera"><Icon name="camera" /><span>Camera</span></button>
              )}
              <button type="button" className={`control-button ${mirror ? 'is-on' : ''}`} onClick={toggleMirror} aria-pressed={mirror} title="Mirror camera"><Icon name="flip" /><span>Mirror</span></button>
              {isFullscreen
                ? <button type="button" className="control-button" aria-label={`Preview ${stageEffectName}`} onClick={() => preview(selectedEffect)}><Icon name="play" /><span>Preview</span></button>
                : <button ref={fullscreenEntry} type="button" className="control-button" aria-label="Enter fullscreen" onClick={toggleFullscreen}><Icon name="fullscreen" /><span>Fullscreen</span></button>}
              <button type="button" className="control-button" onClick={reset} title="Reset preview settings"><Icon name="reset" /><span>Reset</span></button>
            </div>
          </div>
        </section>

        <section className="gift-rail" ref={giftRailRef} aria-labelledby="gift-heading">
          <div className="gift-heading"><strong id="gift-heading">LIVE Effects</strong><span>Smile for rain.<br />Laugh for fireworks.</span></div>
          <div className="gift-scroll">
            {activeGifts.map(gift => (
              <button type="button" key={gift.id} className={`gift-item ${selectedEffect === gift.id ? 'is-selected' : ''}`} onClick={() => preview(gift.id)} aria-pressed={selectedEffect === gift.id}>
                <img className="gift-art" src={gift.icon} alt="" draggable={false} />
                <span className="gift-name">{gift.name}</span>
              </button>
            ))}
            {placeholders.map(gift => (
              <div key={gift.id} className="gift-item gift-placeholder">
                <img className="gift-art" src={gift.icon} alt="" draggable={false} />
                <span className="gift-name">{gift.name}</span>
                <span className="gift-soon">Soon</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <button className="mobile-panel-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="Open live controls"><Icon name="sliders" /></button>

      <aside className={`interaction-panel ${(tutorialStep === null ? drawerOpen : tutorialStep === 1) ? 'is-open' : ''}`} aria-label="Live interaction controls">
        <div className="panel-header"><div><strong>LIVE Controls</strong><span>Local session</span></div><button className="drawer-close" type="button" onClick={() => setDrawerOpen(false)} aria-label="Close live controls"><Icon name="close" /></button></div>
        <section className="panel-section">
          <div className="section-title"><span>Expression status</span><span className={`tracking-status tracking-status-${faceTracking.status}`}>{faceTracking.status}</span></div>
          <div className="expression-row"><div className={`expression-avatar expression-avatar-${faceTracking.sample?.state.toLowerCase() ?? 'no_face'}`}><span /></div><div><strong>{faceTracking.sample?.state.replace('_', ' ') ?? (faceTracking.status === 'loading' ? 'Loading model' : 'No face data')}</strong><p>{faceTracking.message ?? (cameraStatus === 'active' ? 'On-device MediaPipe tracking' : 'Start camera to begin tracking.')}</p></div></div>
          <div className="score-stack" aria-label="Expression scores">
            <ScoreBar label="Smile" value={faceTracking.sample ? (faceTracking.sample.scores.smileLeft + faceTracking.sample.scores.smileRight) / 2 : 0} />
            <ScoreBar label="Jaw open" value={faceTracking.sample?.scores.jawOpen ?? 0} />
            <ScoreBar label="Pucker" value={faceTracking.sample?.scores.mouthPucker ?? 0} />
          </div>
          <label className="toggle-row"><span><strong>Auto Trigger</strong><small>Rain Aura on a smile · Firework Party on a laugh</small></span><input type="checkbox" checked={autoTrigger} onChange={(event) => setAutoTrigger(event.target.checked)} /><i aria-hidden="true" /></label>
        </section>
        <section className="panel-section">
          <div className="section-title"><span>Manual Preview</span></div>
          <div className="range-label"><label htmlFor="intensity-range">Effect intensity</label><output>{intensity}%</output></div>
          <input id="intensity-range" className="range-input" type="range" min="10" max="100" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
          <button className="preview-button" type="button" onClick={() => preview('rain')}><Icon name="play" size={20} /> Preview Rain Aura</button>
          <button className="rain-sound-toggle" type="button" aria-pressed={rainSound} onClick={async () => {
            if (rainSound) {
              rainAudio.disable();
              setRainSound(false);
              setRainAudioError(false);
            } else {
              const enabled = await rainAudio.enable();
              setRainSound(enabled);
              setRainAudioError(!enabled);
            }
          }}>Rain ambience <span>{rainSound ? 'On' : 'Off'}</span></button>
          {rainAudioError && <p className="field-label" role="status">Audio could not start. Tap Rain ambience to retry.</p>}
          <button className="preview-button firework-preview-action" type="button" onClick={() => preview('firework')}><Icon name="play" size={20} /> Preview Firework Party</button>
          <div className="firework-live-settings">
            <button className="rain-sound-toggle" type="button" aria-pressed={fireworkSound} onClick={() => {
              const enabled = !fireworkSound;
              fireworkAudio.setEnabled(enabled);
              setFireworkSound(enabled);
              if (enabled) unlockFireworkSound();
              else setFireworkAudioError(false);
            }}>Firework sound <span>{fireworkSound ? 'On' : 'Off'}</span></button>
            <div className="range-label firework-volume-label"><label htmlFor="firework-volume">Firework volume</label><output>{fireworkVolume}%</output></div>
            <input id="firework-volume" className="range-input" type="range" min="0" max="100" value={fireworkVolume}
              onChange={event => {
                const value = Number(event.target.value);
                setFireworkVolume(value);
                fireworkAudio.setVolume(value / 100);
                unlockFireworkSound();
              }} />
            {fireworkSound && fireworkAudioError && <p className="field-label" role="status">Firework audio could not start. Try Preview Firework Party again.</p>}
            <label className="firework-motion-toggle"><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} /> Reduced Motion</label>
          </div>
        </section>
        <section className="panel-section activity-section">
          <div className="activity-heading"><div className="section-title"><span>Trigger activity</span><span>{events.length}</span></div><div className="combo"><span>Collision combo</span><strong>{combo ?? '—'}</strong><small>{reward ? COMBO_REWARDS[reward] : faceTracking.sample?.pose ? 'Rolling 3 seconds' : 'Needs tracked head'}</small></div></div>
          <div className="event-list" aria-live="polite">
            {events.length === 0 ? <div className="empty-events"><Icon name="activity" /><p>No triggers yet</p><span>Start the camera or preview an effect.</span></div> : events.map((event) => <div className="event-item" key={event.id}><i /><div><strong>{event.label}</strong><span>{event.detail}</span></div></div>)}
          </div>
        </section>
        <details className="debug-panel" ref={debugRef}>
          <summary><span><Icon name="terminal" size={20} /> Debug</span><Icon name="chevron" size={20} /></summary>
          {import.meta.env.DEV && <label className="physics-toggle"><input type="checkbox" checked={showPhysics} onChange={event => setShowPhysics(event.target.checked)} /> Show effect diagnostics</label>}
          <button type="button" className="live-tutorial-replay" onClick={() => setTutorialStep(0)}>Replay tutorial</button>
          <dl>
            <div><dt>Valid hits / 3 s</dt><dd>{combo ?? 0}</dd></div>
            {showPhysics && physics?.contact && <>
              <div><dt>Contact (x, y)</dt><dd>{physics.contact.x.toFixed(2)}, {physics.contact.y.toFixed(2)}</dd></div>
              <div><dt>Normal (x, y)</dt><dd>{physics.contact.nx.toFixed(2)}, {physics.contact.ny.toFixed(2)}</dd></div>
              <div><dt>Velocity before</dt><dd>{physics.contact.beforeX.toFixed(2)}, {physics.contact.beforeY.toFixed(2)}</dd></div>
              <div><dt>Velocity after</dt><dd>{physics.contact.afterX.toFixed(2)}, {physics.contact.afterY.toFixed(2)}</dd></div>
            </>}
            <div><dt>Face Landmarker</dt><dd>{faceTracking.status}</dd></div>
            <div><dt>Inference</dt><dd>{faceTracking.sample ? `${faceTracking.sample.thread} · ${faceTracking.sample.delegate}` : '—'}</dd></div>
            <div><dt>Rate / latency</dt><dd>{faceTracking.sample ? `${faceTracking.sample.inferenceHz.toFixed(1)}Hz · ${faceTracking.sample.inferenceMs.toFixed(1)}ms` : '—'}</dd></div>
            <div><dt>Smile L / R</dt><dd>{faceTracking.sample ? `${faceTracking.sample.scores.smileLeft.toFixed(2)} / ${faceTracking.sample.scores.smileRight.toFixed(2)}` : '—'}</dd></div>
            <div><dt>Smile score (EMA)</dt><dd>{scores ? ((scores.smileLeft + scores.smileRight) / 2).toFixed(2) : '—'}</dd></div>
            <div><dt>Jaw open (EMA)</dt><dd>{scores ? scores.jawOpen.toFixed(2) : '—'}</dd></div>
            <div><dt>Brow up (EMA)</dt><dd>{scores ? scores.browInnerUp.toFixed(2) : '—'}</dd></div>
            <div><dt>Position</dt><dd>{faceTracking.sample?.pose ? `${faceTracking.sample.pose.centerX.toFixed(2)}, ${faceTracking.sample.pose.centerY.toFixed(2)}` : '—'}</dd></div>
            <div><dt>Size / tilt</dt><dd>{faceTracking.sample?.pose ? `${faceTracking.sample.pose.width.toFixed(2)} × ${faceTracking.sample.pose.height.toFixed(2)} · ${faceTracking.sample.pose.rollDegrees.toFixed(1)}°` : '—'}</dd></div>
            <div><dt>Movement speed</dt><dd>{faceTracking.sample?.pose ? faceTracking.sample.pose.speed.toFixed(2) : '—'}</dd></div>
            <div><dt>Camera upload</dt><dd>Disabled</dd></div>
          </dl>
        </details>
      </aside>
      {!entering && tutorialStep !== null && <LiveTutorial step={tutorialStep} onStep={setTutorialStep} onClose={finishTutorial} />}
      {drawerOpen && tutorialStep === null && <button className="drawer-scrim" type="button" onClick={() => setDrawerOpen(false)} aria-label="Close controls" />}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  return <div className="score-row"><span>{label}</span><i><b style={{ width: `${clamped * 100}%` }} /></i><output>{clamped.toFixed(2)}</output></div>;
}
