export const rainAudioTuning = { fadeIn: .9, fadeOut: 1.3, gain: .58, crossfade: 1.8 } as const;
const recording = `${import.meta.env.BASE_URL}audio/rain-on-concrete-1289.mp3`;

export class RainAudio {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private loading: Promise<AudioBuffer> | null = null;
  private buffer: AudioBuffer | null = null;
  private stopTimer: number | undefined;
  private enabled = false;
  private wanted = false;
  private audible = false;
  private generation = 0;

  get status() {
    if (this.source && !this.audible) return 'fading';
    if (!this.enabled) return 'off';
    if (this.context?.state !== 'running') return 'paused';
    return this.audible ? 'playing' : 'ready';
  }

  async enable(): Promise<boolean> {
    const generation = ++this.generation;
    try {
      const context = this.context ??= new AudioContext();
      await context.resume();
      if (generation !== this.generation || context.state !== 'running') return false;
      if (!this.gain) {
        this.gain = context.createGain();
        this.gain.gain.value = 0;
        this.gain.connect(context.destination);
      }
      if (!this.buffer) {
        this.loading ??= this.load(context).catch(error => {
          if (this.context === context) this.loading = null;
          throw error;
        });
        const buffer = await this.loading;
        if (generation !== this.generation) return false;
        this.buffer = buffer;
      }
      this.enabled = true;
      this.sync();
      return true;
    } catch { return false; }
  }

  disable() {
    this.generation++;
    this.enabled = false;
    this.sync();
  }

  update(strength: number | null, fadeOut: number = rainAudioTuning.fadeOut) {
    this.wanted = strength !== null;
    this.sync(fadeOut);
  }

  private async load(context: AudioContext) {
    const response = await fetch(recording);
    if (!response.ok) throw new Error(`Rain recording unavailable (${response.status})`);
    const original = await context.decodeAudioData(await response.arrayBuffer());
    const start = Math.round(4 * original.sampleRate);
    const end = Math.min(original.length, Math.round(55 * original.sampleRate));
    const overlap = Math.round(rainAudioTuning.crossfade * original.sampleRate);
    const length = end - start - overlap;
    if (length <= overlap) throw new Error('Rain recording is incomplete');
    const loop = context.createBuffer(original.numberOfChannels, length, original.sampleRate);
    for (let channel = 0; channel < loop.numberOfChannels; channel++) {
      const input = original.getChannelData(channel);
      const output = loop.getChannelData(channel);
      output.set(input.subarray(start, start + length));
      // The last sample leads into the original tail at the loop seam.
      // That tail crossfades into the head over the first 1.8 seconds.
      for (let i = 0; i < overlap; i++) {
        const t = i / (overlap - 1) * Math.PI / 2;
        output[i] = input[start + length + i] * Math.cos(t) + input[start + i] * Math.sin(t);
      }
    }
    return loop;
  }

  private sync(fadeOut: number = rainAudioTuning.fadeOut) {
    const context = this.context, gain = this.gain, buffer = this.buffer;
    if (!context || !gain || !buffer) return;
    const audible = this.enabled && this.wanted && context.state === 'running';
    if (audible === this.audible && !(this.source && !audible && fadeOut !== rainAudioTuning.fadeOut)) return;
    this.audible = audible;
    const now = context.currentTime;
    window.clearTimeout(this.stopTimer);
    if (audible && !this.source) {
      this.source = context.createBufferSource();
      this.source.buffer = buffer;
      this.source.loop = true;
      this.source.connect(gain);
      this.source.start();
    }
    const volume = gain.gain;
    if (typeof volume.cancelAndHoldAtTime === 'function') volume.cancelAndHoldAtTime(now);
    else { const current = volume.value; volume.cancelScheduledValues(now); volume.setValueAtTime(current, now); }
    volume.linearRampToValueAtTime(audible ? rainAudioTuning.gain : 0,
      now + (audible ? rainAudioTuning.fadeIn : fadeOut));
    if (!audible) this.stopTimer = window.setTimeout(() => this.stop(), (fadeOut + .06) * 1000);
  }

  stopPlayback() {
    this.wanted = this.audible = false;
    window.clearTimeout(this.stopTimer);
    this.stop();
  }

  private stop() {
    this.source?.stop();
    this.source?.disconnect();
    this.source = null;
  }

  dispose() {
    this.generation++;
    window.clearTimeout(this.stopTimer);
    this.stop();
    this.gain?.disconnect();
    void this.context?.close().catch(() => {});
    this.context = this.gain = this.buffer = this.loading = null;
    this.audible = this.enabled = this.wanted = false;
  }
}
