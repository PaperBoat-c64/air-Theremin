/** Time-constant based one-pole low-pass smoother (frame-rate independent). */
export class Smoother {
  private value = 0;
  private initialized = false;

  get current(): number {
    return this.value;
  }

  reset(v = 0): void {
    this.value = v;
    this.initialized = true;
  }

  /** Advance toward `target` with time constant `tau` (seconds). */
  update(target: number, tau: number, dt: number): number {
    if (!this.initialized) {
      this.value = target;
      this.initialized = true;
      return this.value;
    }
    const alpha = 1 - Math.exp(-dt / Math.max(tau, 1e-4));
    this.value += (target - this.value) * alpha;
    return this.value;
  }
}

/** Rolling average used for gesture / value stabilization. */
export class StabilityBuffer<T> {
  private buffer: T[] = [];
  constructor(private size: number) {}

  push(v: T): T | null {
    this.buffer.push(v);
    if (this.buffer.length > this.size) this.buffer.shift();
    return this.settled();
  }

  /** Returns the value only if the whole buffer agrees, else null. */
  settled(): T | null {
    if (this.buffer.length < this.size) return null;
    const first = this.buffer[0];
    for (let i = 1; i < this.buffer.length; i++) {
      if (this.buffer[i] !== first) return null;
    }
    return first;
  }

  clear(): void {
    this.buffer.length = 0;
  }
}
