// 효과음은 전부 Web Audio API로 그 자리에서 합성합니다. 음원 파일도, 외부 요청도 없습니다.

const PENTA = [0, 2, 4, 7, 9];

export class Sfx {
  on = false;
  private ac: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private live = new Set<AudioScheduledSourceNode>();

  setOn(v: boolean) {
    this.on = v;
    if (v) this.ensure();
    else this.stop();
  }

  /** 지금 나는 소리를 전부 끊습니다. */
  stop() {
    for (const n of this.live) {
      try {
        n.stop();
      } catch {}
    }
    this.live.clear();
  }

  private ensure(): AudioContext | null {
    if (!this.on) return null;
    if (!this.ac) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ac = new Ctor();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      const out = ac.createGain();
      out.gain.value = 0.55;
      out.connect(comp).connect(ac.destination);
      const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.ac = ac;
      this.out = out;
      this.noise = buf;
    }
    if (this.ac.state === "suspended") void this.ac.resume();
    return this.ac;
  }

  private track<T extends AudioScheduledSourceNode>(n: T): T {
    this.live.add(n);
    n.onended = () => this.live.delete(n);
    return n;
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    at: number,
    dur: number,
    gain: number,
    attack = 0.004,
  ) {
    const ac = this.ac!;
    const o = this.track(ac.createOscillator());
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.out!);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private hiss(
    at: number,
    dur: number,
    gain: number,
    type: BiquadFilterType,
    f0: number,
    f1 = f0,
    q = 1,
  ): GainNode {
    const ac = this.ac!;
    const s = this.track(ac.createBufferSource());
    s.buffer = this.noise;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + Math.min(0.03, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(this.out!);
    s.start(at, Math.random());
    s.stop(at + dur + 0.02);
    return g;
  }

  /** 타건음. 콤보가 쌓일수록 음이 올라갑니다. hot은 크리티컬. */
  key(combo: number, hot: boolean) {
    const ac = this.ensure();
    if (!ac) return;
    const t = ac.currentTime;
    const step = Math.min(14, Math.floor(combo / 8));
    const semi = PENTA[step % 5] + 12 * Math.floor(step / 5);
    const f = 330 * Math.pow(2, semi / 12);
    this.hiss(t, 0.022, 0.2, "bandpass", 3200 + Math.random() * 900, undefined, 1.2);
    this.tone("sine", 150, 80, t, 0.05, 0.3);
    this.tone("triangle", f, f, t, 0.09, 0.07);
    if (hot) {
      this.tone("sine", 190, 38, t, 0.32, 0.9);
      this.hiss(t, 0.14, 0.35, "lowpass", 1800, 300);
      this.tone("square", f * 2, f * 3, t, 0.12, 0.05);
    }
  }

  /** 콤보 단계가 올랐을 때. */
  tier(level: number) {
    const ac = this.ensure();
    if (!ac) return;
    const t = ac.currentTime;
    const base = 523.25 * Math.pow(2, (level * 2) / 12);
    this.tone("square", base, base, t, 0.09, 0.07);
    this.tone("square", base * 1.5, base * 1.5, t + 0.08, 0.14, 0.07);
  }

  /** 날려버리는 순간의 한 방. */
  boom(power: number) {
    const ac = this.ensure();
    if (!ac) return;
    const t = ac.currentTime + 0.06;
    this.tone("sine", 150, 30, t, 0.55, 0.95 * (0.6 + power * 0.4));
    this.hiss(t, 0.3, 0.5, "lowpass", 900, 120);
  }

  shred(dur: number) {
    const ac = this.ensure();
    if (!ac) return;
    const t = ac.currentTime + 0.07;
    const g = this.hiss(t, dur + 0.1, 0.5, "bandpass", 1500, 2600, 0.8);
    const lfo = this.track(ac.createOscillator());
    const depth = ac.createGain();
    lfo.type = "square";
    lfo.frequency.value = 46;
    depth.gain.value = 0.22;
    lfo.connect(depth).connect(g.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    this.tone("sawtooth", 62, 74, t, dur + 0.1, 0.12, 0.03);
  }

  burn(dur: number) {
    const ac = this.ensure();
    if (!ac) return;
    const t = ac.currentTime + 0.07;
    this.hiss(t, dur + 0.5, 0.42, "lowpass", 700, 1500);
    this.hiss(t, 0.35, 0.5, "bandpass", 500, 2600, 0.6);
    const pops = Math.round(dur * 26);
    for (let i = 0; i < pops; i++) {
      this.hiss(t + Math.random() * (dur + 0.3), 0.012, 0.15 + Math.random() * 0.4, "highpass", 2200 + Math.random() * 3000);
    }
  }

  hole(dur: number) {
    const ac = this.ensure();
    if (!ac) return;
    const t = ac.currentTime + 0.07;
    this.tone("sine", 190, 26, t, dur, 0.6, 0.08);
    this.tone("sawtooth", 95, 20, t, dur, 0.1, 0.1);
    const g = this.hiss(t, dur, 0.02, "bandpass", 300, 4200, 2);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.96);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    // 터지는 순간
    this.tone("sine", 220, 32, t + dur, 0.6, 0.95);
    this.hiss(t + dur, 0.4, 0.5, "lowpass", 2400, 160);
  }

  vapor() {
    const ac = this.ensure();
    if (!ac) return;
    const t = ac.currentTime;
    const g = this.hiss(t, 1.5, 0.01, "highpass", 2600);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  }

  /** 결과 스탬프가 찍힐 때의 짧은 팡파르. level이 높을수록 음이 많습니다. */
  chime(level: number) {
    const ac = this.ensure();
    if (!ac) return;
    const t = ac.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    const n = Math.min(notes.length, 2 + level);
    for (let i = 0; i < n; i++) {
      const at = t + i * 0.065;
      this.tone("triangle", notes[i], notes[i], at, 0.32, 0.2);
      this.tone("sine", notes[i] * 2, notes[i] * 2, at, 0.2, 0.06);
    }
  }
}
