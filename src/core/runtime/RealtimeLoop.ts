export type FrameSubscriber = (deltaSeconds: number, elapsedSeconds: number) => void;

/** Single animation clock for all future high-frequency systems. */
export class RealtimeLoop {
  private readonly subscribers = new Set<FrameSubscriber>();
  private frameId: number | null = null;
  private previousTime = 0;
  private elapsed = 0;

  subscribe(subscriber: FrameSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  start(): void {
    if (this.frameId !== null) return;
    this.previousTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.previousTime = 0;
    this.elapsed = 0;
  }

  private readonly tick = (now: number): void => {
    const delta = Math.min((now - this.previousTime) / 1000, 0.1);
    this.previousTime = now;
    this.elapsed += delta;
    for (const subscriber of this.subscribers) subscriber(delta, this.elapsed);
    this.frameId = requestAnimationFrame(this.tick);
  };
}
