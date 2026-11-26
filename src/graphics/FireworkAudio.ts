import type { FireworkCue } from './FireworkEmitter';

const clips = ['launch', 'burst-a', 'burst-b', 'crackle-a', 'crackle-b'] as const;
type Clip = typeof clips[number];
type Voice = { source: AudioBufferSourceNode; gain: GainNode; start: number };
const maxVoices = 18;

export class FireworkAudio {
  private context: AudioContext | null = null;
  private envelope: GainNode | null = null;
  private fadeNext = false;
  private bus: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private assets: Promise<ArrayBuffer[]> | null = null;
  private loading: Promise<boolean> | null = null;
  private buffers = new Map<Clip, AudioBuffer>();
  private pending: { cue: FireworkCue; time: number }[] = [];
  private voices = new Set<Voice>();
  private enabled = true;
  private volume = .48;

  preload() {
    if (this.assets) return this.assets;
    this.assets = Promise.all(clips.map(async name => {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/fireworks/${name}.mp3`);
      if (!response.ok) throw new Error('Firework clip could not load');
      return response.arrayBuffer();
    }));
    void this.assets.catch(() => { this.assets = null; });
    return this.assets;
  }

  async unlock() {
    if (!this.enabled) return true;
    try {
      if (!this.context) {
        const context = new AudioContext();
        this.context = context;
        this.bus = context.createGain();
        this.envelope = context.createGain();
        this.envelope.connect(this.bus);
        this.bus.gain.value = this.volume;
        this.compressor = context.createDynamicsCompressor();
        this.compressor.threshold.value = -20;
        this.compressor.knee.value = 15;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = .003;
        this.compressor.release.value = .16;
        this.bus.connect(this.compressor).connect(context.destination);
      }
      const context = this.context;
      const resume = context.state === 'running' ? Promise.resolve() : context.resume();
      if (!this.loading) {
        this.loading = this.preload()
          .then(bytes => Promise.all(bytes.map(data => context.decodeAudioData(data.slice(0)))))
          .then(buffers => {
            if (this.context !== context) return false;
            clips.forEach((name, i) => this.buffers.set(name, buffers[i]));
            const pending = this.pending.splice(0);
            for (const event of pending) {
              if (performance.now() - event.time < 140) this.play(event.cue);
            }
            return true;
          }).catch(() => {
            if (this.context === context) { this.loading = null; this.assets = null; }
            return false;
          });
      }
      await resume;
      return context.state === 'running' && await this.loading;
    } catch {
      return false;
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.context && this.bus) this.bus.gain.setTargetAtTime(this.volume, this.context.currentTime, .035);
  }

  play(cue: FireworkCue) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== 'running' || document.hidden) return;
    if (!this.buffers.size) {
      if (this.pending.length < 4) this.pending.push({cue, time: performance.now()});
      return;
    }
    if (this.fadeNext && this.envelope) {
      const volume = this.envelope.gain;
      volume.cancelScheduledValues(ctx.currentTime);
      volume.setValueAtTime(0, ctx.currentTime);
      volume.linearRampToValueAtTime(1, ctx.currentTime + .5);
      this.fadeNext = false;
    }
    const primary = cue.index === 0;
    const size = (primary ? 1 : .69 - cue.index * .095) * (.73 + cue.strength * .27);
    const pan = Math.max(-.58, Math.min(.58, cue.pan * .74));
    const now = ctx.currentTime;
    const wobble = Math.random() - .5;
    if (cue.kind === 'launch') {
      this.voice('launch', now, .12 * size, pan, 1.14 + wobble * .10, .69);
      return;
    }

    const alternate = cue.seed % 2 === 1;
    this.voice(alternate ? 'burst-b' : 'burst-a', now, .42 * size, pan,
      (primary ? .93 : 1.08) + wobble * .13, 1.12, true);
    const crackle = alternate ? 'crackle-a' : 'crackle-b';
    this.voice(crackle, now + .13 + Math.random() * .08, .26 * size, pan,
      .95 + wobble * .14, 1.51);
    const tailStart = cue.duration * .43;
    this.voice(alternate ? 'crackle-b' : 'crackle-a', now + tailStart,
      .13 * size, pan * .86, .91 - wobble * .08, cue.duration + .15 - tailStart);
  }

  beginPlayback() { this.fadeNext = true; }

  get active() { return this.voices.size > 0; }

  stop(fade = .09) {
    this.pending.length = 0;
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    for (const voice of this.voices) {
      if (voice.start > now || fade <= 0) {
        voice.source.stop(now);
        continue;
      }
      const param = voice.gain.gain;
      if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
      else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); }
      param.linearRampToValueAtTime(0, now + fade);
      voice.source.stop(now + fade + .005);
    }
  }

  dispose() {
    this.stop();
    const context = this.context;
    this.context = null;
    this.bus = this.envelope = null;
    this.voices.clear();
    this.compressor = null;
    this.loading = null;
    this.buffers.clear();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  private voice(name: Clip, start: number, level: number, pan: number, rate: number, length: number, priority = false) {
    const buffer = this.buffers.get(name);
    const context = this.context;
    const bus = this.envelope;
    if (!buffer || !context || !bus) return;
    if (this.voices.size >= maxVoices) {
      if (!priority) return;
      const earliest = this.voices.values().next().value;
      if (earliest) {
        this.voices.delete(earliest);
        earliest.source.stop(context.currentTime + .012);
      }
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    const duration = Math.min(length, buffer.duration / rate);
    const end = start + duration;
    source.buffer = buffer;
    source.playbackRate.value = rate;
    panner.pan.value = pan;
    gain.gain.setValueAtTime(level, start);
    gain.gain.setValueAtTime(level, Math.max(start, end - .23));
    gain.gain.linearRampToValueAtTime(0, end);
    source.connect(gain).connect(panner).connect(bus);
    const voice = { source, gain, start };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    source.start(start);
    source.stop(end);
  }
}
