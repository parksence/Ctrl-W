// 화면 전체를 덮는 캔버스 한 장에서 모든 타격감 연출을 처리합니다.
// 타이핑 스파크, 화면 흔들림, 그리고 날려버릴 때의 파쇄·소각·블랙홀·증발 장면.

export type RGB = [number, number, number];
export type Glyph = { ch: string; x: number; y: number; w: number; h: number };
export type Box = { l: number; t: number; r: number; b: number };
export type Snap = {
  glyphs: Glyph[];
  font: string;
  color: string;
  alpha: number;
  area: Box;
  box: Box;
};
export type Kind = "shred" | "burn" | "hole" | "vapor";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  life: number;
  max: number;
  size: number;
  c: RGB;
  // 0 점, 1 궤적, 2 종이 조각, 3 빛 덩어리, 4 글자
  kind: 0 | 1 | 2 | 3 | 4;
  rot: number;
  vr: number;
  add: boolean;
  txt?: string;
};
type Ring = { x: number; y: number; r: number; vr: number; life: number; max: number; c: RGB; w: number };
type Scene = (t: number, dt: number) => boolean;

const TAU = Math.PI * 2;
const MAX_PARTICLES = 2600;
const HIT_STOP = 0.07;

export const MOON: RGB = [238, 242, 230];
export const SUN: RGB = [255, 214, 10];
export const EMBER: RGB = [255, 122, 26];
export const RAGE: RGB = [255, 45, 85];
const ASH: RGB = [92, 104, 96];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const pick = <T,>(list: T[]) => list[(Math.random() * list.length) | 0];

/** 0(차분) → 1(폭주) 사이의 열기를 색으로 바꿉니다. */
export function heatRGB(h: number): RGB {
  if (h <= 0.25) return mix(MOON, SUN, h / 0.25);
  if (h <= 0.6) return mix(SUN, EMBER, (h - 0.25) / 0.35);
  return mix(EMBER, RAGE, clamp((h - 0.6) / 0.4));
}

export class Fx {
  heat = 0;
  heatTarget = 0;
  trauma = 0;
  reduced = false;
  displayFont = "sans-serif";
  onFrame: ((heat: number, dx: number, dy: number) => void) | null = null;

  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private ps: Particle[] = [];
  private rings: Ring[] = [];
  private scene: Scene | null = null;
  private sceneT = 0;
  private flash = 0;
  private raf = 0;
  private last = 0;
  private sprites = new Map<string, HTMLCanvasElement>();

  constructor(private cv: HTMLCanvasElement) {
    this.ctx = cv.getContext("2d")!;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.cv.width = Math.round(this.w * this.dpr);
    this.cv.height = Math.round(this.h * this.dpr);
  }

  kick() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  /** 진행 중인 연출을 전부 지웁니다. 위장 화면으로 넘어갈 때 씁니다. */
  clear() {
    this.ps.length = 0;
    this.rings.length = 0;
    this.scene = null;
    this.flash = 0;
    this.trauma = 0;
    this.heat = 0;
    this.heatTarget = 0;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    this.onFrame?.(0, 0, 0);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.scene = null;
    this.ps.length = 0;
  }

  // ───────────────────────── 타이핑 ─────────────────────────

  /** 글자를 칠 때마다 커서 위치에서 튀는 불꽃. hot이면 격한 표현에 맞은 크리티컬. */
  spark(x: number, y: number, hot: boolean) {
    if (this.reduced) return;
    const heat = this.heat;
    const color = heatRGB(Math.max(heat, 0.18));
    const n = hot ? 30 : 2 + Math.floor(heat * 6);
    for (let i = 0; i < n; i++) {
      const a = hot ? rnd(0, TAU) : rnd(-Math.PI * 0.92, -Math.PI * 0.08);
      const sp = rnd(70, 190 + heat * 340) * (hot ? 1.7 : 1);
      this.add({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: 900,
        drag: 2.4,
        life: rnd(0.22, 0.5) * (hot ? 1.4 : 1),
        size: rnd(1.6, 3 + heat * 2.2),
        c: hot ? pick([RAGE, SUN, MOON]) : i % 3 === 0 ? MOON : color,
        kind: i % 2 ? 1 : 0,
        add: true,
      });
    }
    if (hot) {
      this.ring(x, y, RAGE, 520, 0.42, 3);
      this.word("크리티컬!", x, y - 26, SUN);
    }
    this.kick();
  }

  /** 콤보 단계가 오를 때 터지는 작은 폭죽. */
  burst(x: number, y: number, power = 1) {
    if (this.reduced) return;
    const n = Math.round(26 + power * 30);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU);
      const sp = rnd(120, 520);
      this.add({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        g: 700,
        drag: 2.6,
        life: rnd(0.35, 0.8),
        size: rnd(2, 4.5),
        c: pick([SUN, EMBER, RAGE, MOON]),
        kind: i % 3 === 0 ? 2 : 1,
        add: i % 3 !== 0,
        vr: rnd(-12, 12),
      });
    }
    this.ring(x, y, SUN, 460, 0.4, 2.5);
    this.kick();
  }

  // ───────────────────────── 날려버리기 ─────────────────────────

  /** 장면을 시작하고, 효과음 길이를 맞출 수 있도록 본 연출 시간을 초 단위로 돌려줍니다. */
  play(kind: Kind, snap: Snap, power: number, onClimax: () => void): number {
    this.scene = null;
    if (this.reduced) {
      this.scene = this.sceneFade(snap);
      this.sceneT = 0;
      this.kick();
      window.setTimeout(onClimax, 260);
      return 0.3;
    }
    let made: { scene: Scene; duration: number };
    if (kind === "shred") made = this.sceneShred(snap, power, onClimax);
    else if (kind === "burn") made = this.sceneBurn(snap, power, onClimax);
    else if (kind === "hole") made = this.sceneHole(snap, power, onClimax);
    else made = this.sceneVapor(snap, onClimax);

    this.scene = made.scene;
    if (kind === "vapor") {
      this.sceneT = 0;
    } else {
      // 히트스톱: 아주 잠깐 멈췄다가 섬광과 함께 터집니다.
      this.sceneT = -HIT_STOP;
      this.flash = 0.26 + power * 0.14;
      this.trauma = Math.min(1, this.trauma + 0.45 + power * 0.35);
    }
    this.kick();
    return made.duration;
  }

  // ───────────────────────── 내부 ─────────────────────────

  private tick = (now: number) => {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    const ctx = this.ctx;

    this.heatTarget = Math.max(0, this.heatTarget - dt * 0.5);
    this.heat += (this.heatTarget - this.heat) * Math.min(1, dt * 7);
    if (this.heat < 0.002 && this.heatTarget === 0) this.heat = 0;

    this.trauma = Math.max(0, this.trauma - dt * 1.9);
    let dx = 0;
    let dy = 0;
    if (!this.reduced && this.trauma > 0.01) {
      const s = this.trauma * this.trauma;
      const t = now / 1000;
      dx = Math.round(s * 20 * (Math.sin(t * 71.3) + Math.sin(t * 113.7 + 1.3)) * 0.5);
      dy = Math.round(s * 20 * (Math.sin(t * 83.1 + 2.1) + Math.sin(t * 127.9)) * 0.5);
    }
    this.onFrame?.(this.heat, dx, dy);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    if (this.scene) {
      this.sceneT += dt;
      ctx.save();
      const done = this.scene(this.sceneT, dt);
      ctx.restore();
      if (done) this.scene = null;
    }

    this.drawParticles(dt);
    this.drawRings(dt);

    if (this.flash > 0.01) {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = this.flash;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
      this.flash = Math.max(0, this.flash - dt * 4.5);
    } else {
      this.flash = 0;
    }

    const busy =
      this.scene !== null ||
      this.ps.length > 0 ||
      this.rings.length > 0 ||
      this.flash > 0 ||
      this.trauma > 0.01 ||
      this.heat > 0;
    if (busy) {
      this.raf = requestAnimationFrame(this.tick);
    } else {
      this.raf = 0;
      this.onFrame?.(0, 0, 0);
    }
  };

  private add(p: Partial<Particle> & Pick<Particle, "x" | "y" | "life" | "size" | "c" | "kind">) {
    if (this.ps.length >= MAX_PARTICLES) return;
    this.ps.push({
      vx: 0,
      vy: 0,
      g: 0,
      drag: 0,
      rot: 0,
      vr: 0,
      add: false,
      ...p,
      max: p.life,
    });
  }

  private ring(x: number, y: number, c: RGB, speed: number, life: number, w: number) {
    this.rings.push({ x, y, r: 6, vr: speed, life, max: life, c, w });
  }

  private word(txt: string, x: number, y: number, c: RGB) {
    this.add({ x, y, vy: -90, drag: 2, life: 0.75, size: 20, c, kind: 4, rot: rnd(-0.12, 0.12), txt });
  }

  private sprite(c: RGB): HTMLCanvasElement {
    const key = `${c[0] | 0},${c[1] | 0},${c[2] | 0}`;
    let s = this.sprites.get(key);
    if (!s) {
      s = document.createElement("canvas");
      s.width = s.height = 64;
      const g = s.getContext("2d")!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, css(c, 0.9));
      grad.addColorStop(0.4, css(c, 0.35));
      grad.addColorStop(1, css(c, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      this.sprites.set(key, s);
    }
    return s;
  }

  private drawParticles(dt: number) {
    const ctx = this.ctx;
    const ps = this.ps;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > this.h + 80) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    for (let pass = 0; pass < 2; pass++) {
      const additive = pass === 1;
      ctx.globalCompositeOperation = additive ? "lighter" : "source-over";
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.add !== additive) continue;
        const a = clamp(p.life / p.max);
        if (p.kind === 0) {
          ctx.globalAlpha = a;
          ctx.fillStyle = css(p.c);
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else if (p.kind === 1) {
          ctx.globalAlpha = a;
          ctx.strokeStyle = css(p.c);
          ctx.lineWidth = p.size * 0.7;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          ctx.stroke();
        } else if (p.kind === 2) {
          ctx.globalAlpha = Math.min(1, a * 2);
          ctx.fillStyle = css(p.c);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
          ctx.restore();
        } else if (p.kind === 3) {
          const grow = 1 + (1 - a) * 0.6;
          const s = p.size * grow;
          ctx.globalAlpha = a * 0.85;
          ctx.drawImage(this.sprite(p.c), p.x - s, p.y - s, s * 2, s * 2);
        } else if (p.txt) {
          const pop = 1 + Math.max(0, a - 0.8) * 2.5;
          ctx.globalAlpha = Math.min(1, a * 2.2);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(pop, pop);
          ctx.font = `${p.size}px ${this.displayFont}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          ctx.lineWidth = 5;
          ctx.strokeStyle = "#0a0f0d";
          ctx.strokeText(p.txt, 0, 0);
          ctx.fillStyle = css(p.c);
          ctx.fillText(p.txt, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private drawRings(dt: number) {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "lighter";
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const a = r.life / r.max;
      r.r += r.vr * dt * (0.4 + a * 0.6);
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = css(r.c);
      ctx.lineWidth = r.w * (0.4 + a);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /** 글자들을 한 장의 그림으로 미리 그려 둡니다. */
  private sheet(snap: Snap, x: number, y: number, w: number, h: number) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * this.dpr));
    c.height = Math.max(1, Math.ceil(h * this.dpr));
    const g = c.getContext("2d")!;
    g.scale(this.dpr, this.dpr);
    g.font = snap.font;
    g.fillStyle = snap.color;
    g.textBaseline = "middle";
    for (const q of snap.glyphs) g.fillText(q.ch, q.x - x, q.y + q.h / 2 - y);
    return { c, g };
  }

  private confetti(x0: number, x1: number, y: number, n: number, up: number) {
    for (let i = 0; i < n; i++) {
      this.add({
        x: rnd(x0, x1),
        y: y + rnd(-4, 4),
        vx: rnd(-260, 260),
        vy: rnd(-up, -up * 0.15),
        g: 1500,
        drag: 1.4,
        life: rnd(0.7, 1.5),
        size: rnd(4, 9),
        c: pick([MOON, MOON, SUN, EMBER, RAGE]),
        kind: 2,
        rot: rnd(0, TAU),
        vr: rnd(-14, 14),
      });
    }
  }

  // ── 파쇄: 종이가 아래로 빨려 들어가며 가늘게 잘려 떨어집니다.
  private sceneShred(snap: Snap, power: number, onClimax: () => void) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const pad = 16;
    const bx = snap.box.l - pad;
    const by = snap.box.t - pad;
    const bw = snap.box.r - snap.box.l + pad * 2;
    const bh = snap.box.b - snap.box.t + pad * 2;
    const { c: sheet } = this.sheet(snap, bx, by, bw, bh);
    const slotY = Math.min(by + bh + 14, snap.area.b + 6);
    const travel = Math.max(40, slotY - by);
    const feed = clamp(travel / 950, 0.5, 1.2);
    const speed = travel / feed;
    const sw = 11;
    const n = Math.ceil(bw / sw);
    const strips = Array.from({ length: n }, (_, k) => ({
      jx: (k % 2 ? 1 : -1) * 1.2 + rnd(-0.5, 0.5),
      ph: rnd(0, TAU),
      vx: rnd(-70, 70),
      vr: rnd(-2.2, 2.2),
      delay: rnd(0, 0.16),
    }));
    let climaxed = false;
    const paper = "rgba(238,242,230,0.075)";

    const scene: Scene = (rawT, dt) => {
      const t = Math.max(0, rawT);
      const moved = Math.min(travel, speed * t);
      const top = by + moved;
      const passed = clamp(top + bh - slotY, 0, bh);
      const feeding = t <= feed;

      // 아직 잘리지 않은 윗부분
      if (top < slotY) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, this.w, slotY);
        ctx.clip();
        ctx.fillStyle = paper;
        ctx.globalAlpha = clamp(t / 0.1);
        ctx.fillRect(bx, top, bw, bh);
        ctx.globalAlpha = 1;
        ctx.drawImage(sheet, bx, top, bw, bh);
        ctx.restore();
      }

      // 잘려 나온 가닥들
      if (passed > 0) {
        const sy = (bh - passed) * dpr;
        for (let k = 0; k < n; k++) {
          const s = strips[k];
          const sx = k * sw;
          const w = Math.min(sw - 1.6, bw - sx);
          if (w <= 0) continue;
          const td = t - feed - s.delay;
          if (td < 0) {
            const sway = Math.sin(t * 16 + s.ph) * 1.8 * Math.min(1, passed / 90);
            const dx = bx + sx + s.jx + sway;
            ctx.fillStyle = paper;
            ctx.fillRect(dx, slotY, w, passed);
            ctx.drawImage(sheet, sx * dpr, sy, w * dpr, passed * dpr, dx, slotY, w, passed);
          } else {
            const a = 1 - td / 0.8;
            if (a <= 0) continue;
            const fall = speed * 0.5 * td + 0.5 * 2800 * td * td;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate(bx + sx + s.jx + s.vx * td + w / 2, slotY + fall + passed / 2);
            ctx.rotate(s.vr * td);
            ctx.fillStyle = paper;
            ctx.fillRect(-w / 2, -passed / 2, w, passed);
            ctx.drawImage(sheet, sx * dpr, sy, w * dpr, passed * dpr, -w / 2, -passed / 2, w, passed);
            ctx.restore();
          }
        }
      }

      // 파쇄기 입구
      const slotA = feeding ? clamp(t / 0.08) : clamp(1 - (t - feed) / 0.35);
      if (slotA > 0) {
        ctx.globalAlpha = slotA;
        ctx.fillStyle = css(MOON, 0.9);
        ctx.fillRect(bx - 12, slotY - 2, bw + 24, 3);
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = css(heatRGB(0.3 + power * 0.6), 0.5);
        ctx.fillRect(bx - 12, slotY - 5, bw + 24, 9);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }

      if (feeding && rawT >= 0) {
        this.trauma = Math.max(this.trauma, 0.22 + power * 0.14);
        const rate = Math.round((1 + power * 5) * dt * 60);
        for (let i = 0; i < rate; i++) {
          this.add({
            x: rnd(bx, bx + bw),
            y: slotY,
            vx: rnd(-90, 90),
            vy: rnd(-260, 40),
            g: 1200,
            drag: 1.5,
            life: rnd(0.25, 0.6),
            size: rnd(1.5, 3.2),
            c: pick([MOON, SUN, heatRGB(0.5 + power * 0.5)]),
            kind: i % 2 ? 1 : 0,
            add: true,
          });
        }
      }

      if (!feeding && !climaxed) {
        climaxed = true;
        this.confetti(bx, bx + bw, slotY, Math.round(50 + power * 170), 620 + power * 420);
        this.ring(bx + bw / 2, slotY, MOON, 900, 0.5, 4);
        this.ring(bx + bw / 2, slotY, EMBER, 600, 0.6, 3);
        this.trauma = Math.min(1, this.trauma + 0.4 + power * 0.3);
        this.flash = Math.max(this.flash, 0.18);
        onClimax();
      }
      return t > feed + 1.05;
    };
    return { scene, duration: feed };
  }

  // ── 소각: 마지막 글자에서 불이 붙어 번져 나갑니다.
  private sceneBurn(snap: Snap, power: number, onClimax: () => void) {
    const ctx = this.ctx;
    const pad = 6;
    const bx = snap.box.l - pad;
    const by = snap.box.t - pad;
    const bw = snap.box.r - snap.box.l + pad * 2;
    const bh = snap.box.b - snap.box.t + pad * 2;
    const { c: sheet, g: sg } = this.sheet(snap, bx, by, bw, bh);
    const last = snap.glyphs[snap.glyphs.length - 1];
    const ox = last.x + last.w / 2;
    const oy = last.y + last.h / 2;
    let maxD = 1;
    const items = snap.glyphs.map((q) => {
      const d = Math.hypot(q.x + q.w / 2 - ox, q.y + q.h / 2 - oy);
      if (d > maxD) maxD = d;
      return { q, d, tb: 0, lit: false, burst: false };
    });
    const spread = clamp(maxD / 850, 0.35, 1.15);
    for (const it of items) it.tb = 0.04 + (it.d / maxD) * spread + rnd(0, 0.05);
    items.sort((a, b) => a.tb - b.tb);
    const HEATUP = 0.2;
    const CHAR = 0.42;
    const end = items[items.length - 1].tb;
    const density = Math.min(1, 420 / items.length);
    const white: RGB = [255, 244, 214];
    const coal: RGB = [70, 22, 10];
    let i0 = 0;
    let i1 = 0;
    let started = false;
    let climaxed = false;

    const scene: Scene = (rawT, dt) => {
      const t = Math.max(0, rawT);
      if (!started && rawT >= 0) {
        started = true;
        this.ring(ox, oy, SUN, 1100, 0.55, 5);
        this.ring(ox, oy, RAGE, 700, 0.7, 3);
        for (let i = 0; i < 26 + power * 40; i++) {
          const a = rnd(0, TAU);
          const sp = rnd(160, 620);
          this.add({
            x: ox,
            y: oy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            g: 500,
            drag: 2.4,
            life: rnd(0.3, 0.8),
            size: rnd(2, 4),
            c: pick([SUN, EMBER, white]),
            kind: 1,
            add: true,
          });
        }
      }
      while (i1 < items.length && items[i1].tb - HEATUP <= t) {
        const { q } = items[i1];
        sg.clearRect(q.x - bx - 1, q.y - by, q.w + 2, q.h);
        i1++;
      }
      while (i0 < i1 && t > items[i0].tb + CHAR) i0++;

      ctx.drawImage(sheet, bx, by, bw, bh);

      // 달아오른 글자 뒤의 불빛
      ctx.globalCompositeOperation = "lighter";
      for (let i = i0; i < i1; i++) {
        const it = items[i];
        const u = clamp((t - (it.tb - HEATUP)) / HEATUP);
        const v = clamp((t - it.tb) / CHAR);
        const glow = u * (1 - v);
        if (glow <= 0.02) continue;
        const s = it.q.h * (1.1 + u * 0.9);
        ctx.globalAlpha = glow * 0.6;
        ctx.drawImage(this.sprite(v > 0.3 ? RAGE : EMBER), it.q.x + it.q.w / 2 - s, it.q.y + it.q.h / 2 - s, s * 2, s * 2);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;

      ctx.font = snap.font;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      for (let i = i0; i < i1; i++) {
        const it = items[i];
        const { q } = it;
        const u = clamp((t - (it.tb - HEATUP)) / HEATUP);
        const v = clamp((t - it.tb) / CHAR);
        const cx = q.x + q.w / 2;
        const cy = q.y + q.h / 2;
        let col: RGB;
        if (v <= 0) col = u < 0.5 ? mix(MOON, white, u * 2) : mix(white, SUN, (u - 0.5) * 2);
        else if (v < 0.35) col = mix(SUN, RAGE, v / 0.35);
        else col = mix(RAGE, coal, (v - 0.35) / 0.65);
        ctx.globalAlpha = 1 - Math.pow(v, 1.6);
        ctx.fillStyle = css(col);
        ctx.save();
        ctx.translate(cx, cy - v * 10);
        ctx.rotate(v * (i % 2 ? 0.35 : -0.35));
        const sc = 1 + u * 0.12 - v * 0.4;
        ctx.scale(sc, sc * (1 - v * 0.25));
        ctx.fillText(q.ch, 0, 0);
        ctx.restore();

        if (t >= it.tb && v < 1) {
          if (!it.burst) {
            it.burst = true;
            if (Math.random() < density) {
              for (let k = 0; k < 2; k++) {
                this.add({
                  x: cx + rnd(-4, 4),
                  y: cy,
                  vx: rnd(-50, 50),
                  vy: rnd(-260, -90),
                  g: -60,
                  drag: 0.9,
                  life: rnd(0.6, 1.4),
                  size: rnd(1.6, 3.2),
                  c: pick([SUN, EMBER, RAGE]),
                  kind: 0,
                  add: true,
                });
              }
              this.add({
                x: cx,
                y: cy,
                vx: rnd(-30, 30),
                vy: rnd(-20, 30),
                g: 60,
                drag: 0.6,
                life: rnd(0.8, 1.6),
                size: rnd(2.5, 5),
                c: ASH,
                kind: 2,
                rot: rnd(0, TAU),
                vr: rnd(-4, 4),
              });
            }
          }
          if (Math.random() < density * dt * 22) {
            this.add({
              x: cx + rnd(-q.w * 0.4, q.w * 0.4),
              y: cy + rnd(-2, 6),
              vx: rnd(-18, 18),
              vy: rnd(-190, -70),
              g: -120,
              drag: 1.2,
              life: rnd(0.3, 0.6),
              size: q.h * rnd(0.45, 0.85),
              c: pick([SUN, EMBER, EMBER, RAGE]),
              kind: 3,
              add: true,
            });
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";

      if (rawT >= 0 && t < end + CHAR) this.trauma = Math.max(this.trauma, 0.2 + power * 0.14);
      if (!climaxed && t >= end + CHAR * 0.6) {
        climaxed = true;
        this.trauma = Math.min(1, this.trauma + 0.3 + power * 0.25);
        onClimax();
      }
      return t > end + CHAR + 0.4;
    };
    return { scene, duration: end + CHAR };
  }

  // ── 블랙홀: 글자들이 소용돌이치며 한 점으로 빨려 들어갑니다.
  private sceneHole(snap: Snap, power: number, onClimax: () => void) {
    const ctx = this.ctx;
    const ax = (snap.area.l + snap.area.r) / 2;
    const ay = (snap.area.t + snap.area.b) / 2;
    const cx = lerp(ax, (snap.box.l + snap.box.r) / 2, 0.35);
    const cy = lerp(ay, (snap.box.t + snap.box.b) / 2, 0.35);
    let maxR = 1;
    const items = snap.glyphs.map((q) => {
      const dx = q.x + q.w / 2 - cx;
      const dy = q.y + q.h / 2 - cy;
      const r0 = Math.hypot(dx, dy);
      if (r0 > maxR) maxR = r0;
      return { q, r0, th0: Math.atan2(dy, dx), delay: 0, dur: rnd(0.62, 0.86) };
    });
    let end = 0;
    for (const it of items) {
      it.delay = 0.1 + (it.r0 / maxR) * 0.5 + rnd(0, 0.07);
      end = Math.max(end, it.delay + it.dur);
    }
    const R0 = 22 + power * 16;
    const COLLAPSE = 0.22;
    const hot: RGB = [255, 208, 138];
    let climaxed = false;

    const scene: Scene = (rawT) => {
      const t = Math.max(0, rawT);
      const grow = clamp(t / 0.28);
      const back = 1 + 2.2 * Math.pow(grow - 1, 3) + 1.2 * Math.pow(grow - 1, 2);
      const fade = t > end ? clamp(1 - (t - end) / COLLAPSE) : 1;
      const R = R0 * back * fade * (1 + 0.05 * Math.sin(t * 40));

      // 빨려 드는 빛
      if (R > 0.5) {
        ctx.globalCompositeOperation = "lighter";
        const halo = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 5);
        halo.addColorStop(0, css(EMBER, 0.42));
        halo.addColorStop(0.4, css(RAGE, 0.14));
        halo.addColorStop(1, css(RAGE, 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 5, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }

      ctx.font = snap.font;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      for (const it of items) {
        const tau = clamp((t - it.delay) / it.dur);
        if (tau >= 1) continue;
        const e = tau * tau * tau;
        const r = it.r0 * (1 - e);
        const adv = 1.7 * Math.log(1 / (1 - e * 0.985));
        const th = it.th0 + adv;
        const sc = 0.18 + 0.82 * (1 - e);
        ctx.globalAlpha = tau < 0.86 ? 1 : 1 - (tau - 0.86) / 0.14;
        ctx.fillStyle = css(mix(MOON, hot, e));
        ctx.save();
        ctx.translate(cx + Math.cos(th) * r, cy + Math.sin(th) * r);
        ctx.rotate(adv);
        ctx.scale(sc * (1 + e * 1.6), sc);
        ctx.fillText(it.q.ch, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";

      // 사건의 지평선
      if (R > 0.5) {
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = css(SUN, 0.9);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 1.5, t * 9, t * 9 + Math.PI * 1.5);
        ctx.stroke();
        ctx.strokeStyle = css(RAGE, 0.7);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 5, -t * 6, -t * 6 + Math.PI * 1.1);
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }

      if (rawT >= 0 && t < end) this.trauma = Math.max(this.trauma, 0.16 + (t / end) * 0.2);
      if (!climaxed && t >= end + COLLAPSE) {
        climaxed = true;
        this.flash = Math.max(this.flash, 0.3);
        this.trauma = Math.min(1, this.trauma + 0.5 + power * 0.3);
        this.ring(cx, cy, MOON, 1500, 0.55, 6);
        this.ring(cx, cy, SUN, 1000, 0.7, 4);
        this.ring(cx, cy, RAGE, 620, 0.85, 3);
        const n = Math.round(70 + power * 150);
        for (let i = 0; i < n; i++) {
          const a = rnd(0, TAU);
          const sp = rnd(200, 1100);
          this.add({
            x: cx,
            y: cy,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            drag: 2.8,
            life: rnd(0.4, 1.1),
            size: rnd(1.6, 4),
            c: pick([MOON, SUN, EMBER, RAGE]),
            kind: 1,
            add: true,
          });
        }
        onClimax();
      }
      return t > end + COLLAPSE + 0.3;
    };
    return { scene, duration: end + COLLAPSE };
  }

  // ── 증발: 타이머가 다 되면 조용히 김처럼 흩어집니다.
  private sceneVapor(snap: Snap, onClimax: () => void) {
    const ctx = this.ctx;
    const width = Math.max(1, snap.box.r - snap.box.l);
    const items = snap.glyphs.map((q) => ({
      q,
      delay: rnd(0, 0.45) + ((q.x - snap.box.l) / width) * 0.3,
      dur: rnd(0.9, 1.4),
      dx: rnd(-16, 16),
      rise: rnd(40, 95),
      ph: rnd(0, TAU),
    }));
    let climaxed = false;
    const scene: Scene = (t) => {
      ctx.font = snap.font;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillStyle = snap.color;
      for (const it of items) {
        const tau = clamp((t - it.delay) / it.dur);
        if (tau >= 1) continue;
        const e = 1 - Math.pow(1 - tau, 2);
        ctx.globalAlpha = snap.alpha * Math.pow(1 - tau, 1.5);
        ctx.save();
        ctx.translate(
          it.q.x + it.q.w / 2 + it.dx * tau + Math.sin(tau * 5 + it.ph) * 3,
          it.q.y + it.q.h / 2 - it.rise * e,
        );
        const sc = 1 + tau * 0.6;
        ctx.scale(sc, sc);
        ctx.fillText(it.q.ch, 0, 0);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = "left";
      if (!climaxed && t > 1.0) {
        climaxed = true;
        onClimax();
      }
      return t > 2.0;
    };
    return { scene, duration: 1.6 };
  }

  // ── 움직임 줄이기 설정을 켠 사람에게는 조용한 사라짐만 보여줍니다.
  private sceneFade(snap: Snap): Scene {
    const ctx = this.ctx;
    return (t) => {
      ctx.font = snap.font;
      ctx.textBaseline = "middle";
      ctx.fillStyle = snap.color;
      ctx.globalAlpha = snap.alpha * clamp(1 - t / 0.28);
      for (const q of snap.glyphs) ctx.fillText(q.ch, q.x, q.y + q.h / 2);
      ctx.globalAlpha = 1;
      return t > 0.3;
    };
  }
}
