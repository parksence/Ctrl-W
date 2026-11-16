// 화면 바닥에서 솟는 "대숲 이퀄라이저".
// 대나무 마디처럼 끊긴 막대가 타자를 칠 때마다 튀어 오르고, 열기에 따라 색이 달아오릅니다.

import { heatRGB } from "./fx";

type Bar = { x: number; base: number; lvl: number };

const SEG_GAP = 7;
const BAR_W = 12;

export class Grove {
  heat = 0;
  fever = false;
  reduced = false;

  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private bars: Bar[] = [];
  private cursor = 0;
  private raf = 0;
  private last = 0;
  private clock = 0;

  constructor(private cv: HTMLCanvasElement) {
    this.ctx = cv.getContext("2d")!;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.cv.clientWidth || window.innerWidth;
    this.h = this.cv.clientHeight || window.innerHeight;
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
    const step = this.w < 560 ? 22 : 30;
    const n = Math.max(6, Math.floor(this.w / step));
    const off = (this.w - n * step) / 2 + (step - BAR_W) / 2;
    const old = this.bars;
    this.bars = Array.from({ length: n }, (_, i) => ({
      x: off + i * step,
      // 가만히 있을 때의 낮은 대숲 실루엣 (막대마다 높이가 조금씩 다릅니다)
      base: 1 + (Math.floor(Math.abs(Math.sin(i * 12.9898) * 43758.5453)) % 3),
      lvl: old[i]?.lvl ?? 0,
    }));
    this.draw(0);
  }

  /** 타자 한 번에 막대 몇 개가 튀어 오릅니다. */
  kick(strength: number) {
    if (this.reduced) return;
    const n = this.bars.length;
    this.cursor = (this.cursor + 5 + Math.floor(Math.random() * 4)) % n;
    for (let d = -2; d <= 2; d++) {
      const b = this.bars[(this.cursor + d + n) % n];
      b.lvl = Math.min(1, b.lvl + strength * (1 - Math.abs(d) * 0.3));
    }
    this.wake();
  }

  /** 모든 막대가 한꺼번에 치솟습니다. */
  flare(amount = 1) {
    if (this.reduced) return;
    for (const b of this.bars) b.lvl = Math.max(b.lvl, amount * (0.6 + Math.random() * 0.4));
    this.wake();
  }

  clear() {
    for (const b of this.bars) b.lvl = 0;
    this.heat = 0;
    this.fever = false;
    this.draw(0);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private wake() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    const live = this.draw(dt);
    this.raf = live || this.fever ? requestAnimationFrame(this.tick) : 0;
  };

  private draw(dt: number): boolean {
    const c = this.ctx;
    const { w, h } = this;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    const seg = h < 560 ? 24 : 34;
    const maxSeg = Math.max(4, Math.floor((h * 0.78) / (seg + SEG_GAP)));
    let live = false;
    this.bars.forEach((b, i) => {
      // 폭주 중에는 파도처럼 계속 출렁입니다.
      if (this.fever) b.lvl = Math.max(b.lvl, 0.42 + 0.3 * Math.sin(this.clock * 7 + i * 0.55));
      b.lvl *= Math.exp(-dt * 3.2);
      if (b.lvl < 0.006) b.lvl = 0;
      else live = true;
      const lit = Math.round(b.lvl * maxSeg);
      const top = Math.max(b.base, lit);
      for (let s = 0; s < top; s++) {
        const y = h - (s + 1) * (seg + SEG_GAP) + SEG_GAP;
        if (s < lit) {
          c.globalAlpha = 0.16 + 0.34 * b.lvl;
          if (this.fever) {
            c.fillStyle = `hsl(${(i * 14 + s * 10 + this.clock * 260) % 360} 100% 62%)`;
          } else {
            const [r, g, bl] = heatRGB(Math.min(1, 0.22 + (s / maxSeg) * 0.6 + this.heat * 0.4));
            c.fillStyle = `rgb(${r | 0} ${g | 0} ${bl | 0})`;
          }
        } else {
          c.globalAlpha = 1;
          c.fillStyle = "#121b16";
        }
        c.beginPath();
        if (c.roundRect) c.roundRect(b.x, y, BAR_W, seg, 4);
        else c.rect(b.x, y, BAR_W, seg);
        c.fill();
      }
    });
    c.globalAlpha = 1;
    return live;
  }
}
