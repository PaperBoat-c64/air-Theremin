/**
 * Shared effect buses. A sound source (the engine's voice bus) connects its
 * output into `connectSource`, which fans it out to dry + wet sends. The final
 * `output` feeds a glue compressor and then the destination.
 */
export class Effects {
  readonly ctx: AudioContext;

  readonly dry: GainNode;
  readonly output: GainNode;

  private reverbSend: GainNode;
  private delaySend: GainNode;
  private chorusSend: GainNode;

  private compressor: DynamicsCompressorNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.dry = ctx.createGain();
    this.dry.gain.value = 1;

    this.output = ctx.createGain();
    this.output.gain.value = 1;

    // --- reverb ---
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.32;
    const reverb = ctx.createConvolver();
    reverb.buffer = generateImpulse(ctx, 3.4, 3.2);
    this.reverbSend.connect(reverb).connect(this.output);

    // --- delay ---
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.2;
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = 0.42;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.42;
    delay.connect(feedback).connect(delay);
    const delayWet = ctx.createGain();
    delayWet.gain.value = 1;
    this.delaySend.connect(delay);
    delay.connect(delayWet).connect(this.output);

    // --- chorus ---
    this.chorusSend = ctx.createGain();
    this.chorusSend.gain.value = 0.3;
    this.buildChorus(this.chorusSend);

    this.dry.connect(this.output);

    // --- glue compressor ---
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.22;
    this.output.connect(this.compressor);
  }

  /** Connect a sound source into every effect bus. */
  connectSource(node: AudioNode): void {
    node.connect(this.dry);
    node.connect(this.reverbSend);
    node.connect(this.delaySend);
    node.connect(this.chorusSend);
  }

  connect(dest: AudioNode): void {
    this.compressor.connect(dest);
  }

  setReverb(amount: number): void {
    this.reverbSend.gain.setTargetAtTime(amount * 0.85, this.ctx.currentTime, 0.08);
  }

  setDelay(amount: number): void {
    this.delaySend.gain.setTargetAtTime(amount * 0.55, this.ctx.currentTime, 0.08);
  }

  setChorus(amount: number): void {
    this.chorusSend.gain.setTargetAtTime(amount * 0.7, this.ctx.currentTime, 0.08);
  }

  setMaster(level: number): void {
    this.output.gain.setTargetAtTime(level, this.ctx.currentTime, 0.05);
  }

  private buildChorus(input: GainNode): void {
    const mk = (base: number, pan: number, rate: number) => {
      const d = this.ctx.createDelay(0.1);
      d.delayTime.value = base;
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = rate;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.004;
      lfo.connect(lfoGain).connect(d.delayTime);
      lfo.start();
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.5;
      d.connect(panner).connect(wet).connect(this.output);
      return d;
    };
    input.connect(mk(0.022, -0.7, 0.18));
    input.connect(mk(0.029, 0.7, 0.24));
  }
}

function generateImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}
