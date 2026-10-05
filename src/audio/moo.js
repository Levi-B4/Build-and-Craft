// Synthesised highland-cow moo using the Web Audio API (no audio files).

export class MooAudio {
  constructor() {
    this.ctx = null;
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    });
  }

  /** Create/resume the AudioContext. Must be called from a user gesture (click / touchend). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      // Silent buffer unlocks audio on iOS
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      /* audio unavailable */
    }
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /**
   * Play a moo.
   * @param {number} volume 0..1
   * @param {number} pan -1 (left) .. 1 (right)
   * @param {number} pitch multiplier (per-cow variation)
   */
  moo(volume = 1, pan = 0, pitch = 1) {
    if (!this.ready || volume <= 0.01) return false;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 1.1 + Math.random() * 0.4;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.35 * volume, t + 0.12);
    out.gain.setValueAtTime(0.35 * volume, t + dur - 0.35);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    let node = out;
    if (ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(panner);
      node = panner;
    }
    node.connect(ctx.destination);

    // Formant-ish low-pass on a buzzy source
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(350, t);
    filter.frequency.linearRampToValueAtTime(900, t + 0.35);
    filter.frequency.linearRampToValueAtTime(450, t + dur);
    filter.connect(out);

    const base = 110 * pitch;
    const oscs = [];
    for (const [type, mult, gain] of [['sawtooth', 1, 0.6], ['square', 0.5, 0.25]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(base * mult * 0.9, t);
      osc.frequency.linearRampToValueAtTime(base * mult * 1.08, t + 0.3);
      osc.frequency.linearRampToValueAtTime(base * mult * 0.78, t + dur);
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(filter);
      oscs.push(osc);
    }
    // Slight vibrato
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3;
    lfo.connect(lfoGain);
    for (const o of oscs) lfoGain.connect(o.frequency);
    for (const o of [...oscs, lfo]) {
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    return true;
  }
}
