"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { CYAN, Fx, heatRGB, type Kind } from "@/lib/fx";
import { Grove } from "@/lib/grove";
import { hotAt } from "@/lib/hot";
import { caretPoint, snapshot } from "@/lib/measure";
import { Sfx } from "@/lib/sfx";
import {
  bumpTally,
  clearDraft,
  loadDraft,
  prefsStore,
  saveDraft,
  tallyStore,
  type Effect,
  type Mode,
} from "@/lib/store";
import Disguise from "./Disguise";

const MODES: { id: Mode; label: string }[] = [
  { id: "now", label: "직접 날리기" },
  { id: "timer", label: "멈추면 증발" },
  { id: "tab", label: "탭 닫으면 증발" },
];
const SECS: { id: 10 | 30 | 60; label: string }[] = [
  { id: 10, label: "10초" },
  { id: 30, label: "30초" },
  { id: 60, label: "1분" },
];
const EFFECTS: { id: Effect; label: string; verb: string }[] = [
  { id: "shred", label: "파쇄", verb: "파쇄" },
  { id: "burn", label: "소각", verb: "소각" },
  { id: "hole", label: "블랙홀", verb: "소멸" },
  { id: "blast", label: "폭파", verb: "폭파" },
];
// 콤보가 이 숫자에 닿으면 자막이 터집니다.
const TIERS: [number, string][] = [
  [30, "시동 걸렸다"],
  [80, "손가락에 불났다"],
  [150, "키보드가 운다"],
  [300, "분노의 타건"],
  [500, "전설의 타건"],
];
// 점수에 따른 랭크와 한마디. 점수는 타자 한 번에 10점 × 배율, 크리티컬은 300점 × 배율입니다.
const RANKS: { id: string; min: number; say: string }[] = [
  { id: "D", min: 0, say: "몸풀기" },
  { id: "C", min: 500, say: "가볍게 한 방" },
  { id: "B", min: 2500, say: "속이 좀 풀린다" },
  { id: "A", min: 8000, say: "묵은 체증이 내려간다" },
  { id: "S", min: 25000, say: "제대로 터졌다" },
  { id: "SS", min: 70000, say: "오늘의 역대급" },
];
const CRIT_BONUS = 300;
// 콤보가 여기에 닿으면 폭주 모드: 화면이 무지개로 돌고 점수가 2배가 됩니다.
const FEVER_AT = 50;
// 이만큼 쓰면 게이지가 꽉 찹니다.
const FULL = 300;

type Stamp = {
  id: number;
  quiet: boolean;
  main: string;
  sub: string;
  foot: string;
  rank?: string;
  score?: number;
  record?: boolean;
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const countChars = (s: string) => s.replace(/\s/g, "").length;

// "탭 닫으면 증발" 모드였다면 새로고침 전 글을 한 번만 되살립니다.
let bootDraft: string | undefined;
const subscribeNever = () => () => {};
const getBootDraft = () => {
  if (bootDraft === undefined) {
    bootDraft = prefsStore.get().mode === "tab" ? loadDraft() : "";
    if (!bootDraft) clearDraft();
  }
  return bootDraft;
};

const touchQuery = "(pointer: coarse)";
const subscribeTouch = (cb: () => void) => {
  const mq = window.matchMedia(touchQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** 0에서 목표 숫자까지 빠르게 올라가는 숫자. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 750);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString("ko-KR");
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span ref={ref}>0</span>;
}

export default function Vent() {
  const prefs = useSyncExternalStore(prefsStore.subscribe, prefsStore.get, prefsStore.getServer);
  const tally = useSyncExternalStore(tallyStore.subscribe, tallyStore.get, tallyStore.getServer);
  const touch = useSyncExternalStore(
    subscribeTouch,
    () => window.matchMedia(touchQuery).matches,
    () => false,
  );

  const restored = useSyncExternalStore(subscribeNever, getBootDraft, () => "");
  const [typed, setText] = useState<string | null>(null);
  const text = typed ?? restored;
  const [disguised, setDisguised] = useState(false);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [score, setScore] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const groveRef = useRef<HTMLCanvasElement>(null);
  const multRef = useRef<HTMLElement>(null);
  const comboRef = useRef<HTMLDivElement>(null);
  const comboNumRef = useRef<HTMLSpanElement>(null);
  const calloutRef = useRef<HTMLElement>(null);
  const fx = useRef<Fx | null>(null);
  const sfx = useRef<Sfx | null>(null);
  const grove = useRef<Grove | null>(null);
  const live = useRef({
    combo: 0,
    peak: 0,
    score: 0,
    crits: 0,
    fever: false,
    hits: [] as number[],
    hot: -1,
    lastInput: 0,
    comboTimer: 0,
    stampTimer: 0,
  });

  const hasText = text.length > 0;
  const chars = countChars(text);
  const gauge = Math.min(1, chars / FULL);

  // ── 연출 엔진과 효과음 준비
  useEffect(() => {
    const root = rootRef.current!;
    const shell = shellRef.current!;
    const engine = new Fx(cvRef.current!);
    fx.current = engine;
    sfx.current = new Sfx();
    const bars = new Grove(groveRef.current!);
    grove.current = bars;
    engine.displayFont =
      getComputedStyle(document.documentElement).getPropertyValue("--font-bhs").trim() || "sans-serif";

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      engine.reduced = motion.matches;
      bars.reduced = motion.matches;
    };
    syncMotion();
    motion.addEventListener("change", syncMotion);

    let shown = -1;
    engine.onFrame = (heat, dx, dy) => {
      shell.style.transform = dx || dy ? `translate3d(${dx}px,${dy}px,0)` : "";
      bars.heat = heat;
      if (heat === shown) return;
      shown = heat;
      const c = heatRGB(heat);
      root.style.setProperty("--heat", heat.toFixed(3));
      root.style.setProperty("--hc", `${c[0] | 0} ${c[1] | 0} ${c[2] | 0}`);
    };

    const onResize = () => {
      engine.resize();
      bars.resize();
    };
    window.addEventListener("resize", onResize);

    // 모바일에서 키보드가 올라와도 버튼이 가려지지 않도록 보이는 영역 높이에 맞춥니다.
    const vv = window.visualViewport;
    const syncViewport = () => {
      if (!vv || vv.scale !== 1) return;
      root.style.setProperty("--vvh", `${vv.height}px`);
      root.style.setProperty("--vvt", `${vv.offsetTop}px`);
      bars.resize();
    };
    syncViewport();
    vv?.addEventListener("resize", syncViewport);
    vv?.addEventListener("scroll", syncViewport);

    return () => {
      motion.removeEventListener("change", syncMotion);
      window.removeEventListener("resize", onResize);
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
      engine.dispose();
      bars.dispose();
      sfx.current?.stop();
    };
  }, []);

  useEffect(() => {
    const audio = sfx.current;
    if (!audio) return;
    audio.on = prefs.sound;
    if (!prefs.sound) audio.stop();
  }, [prefs.sound]);

  // ── Esc 두 번: 위장 화면 켜고 끄기
  useEffect(() => {
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const now = performance.now();
      if (now - last < 600) {
        last = 0;
        setDisguised((d) => !d);
      } else {
        last = now;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onDisguise = useEffectEvent((on: boolean) => {
    if (on) {
      fx.current?.clear();
      grove.current?.clear();
      sfx.current?.stop();
      endCombo();
    } else {
      taRef.current?.focus({ preventScroll: true });
    }
  });
  useEffect(() => onDisguise(disguised), [disguised]);

  // ── "멈추면 증발": 입력이 멈춘 뒤 남은 시간을 세다가 0이 되면 증발
  const expire = useEffectEvent(() => destroy("vapor"));
  useEffect(() => {
    const ta = taRef.current;
    if (!ta || prefs.mode !== "timer" || !hasText) return;
    const id = window.setInterval(() => {
      const idle = (performance.now() - live.current.lastInput) / 1000;
      const frac = Math.min(1, idle / prefs.sec);
      ta.style.setProperty("--fade", frac.toFixed(3));
      setLeft(Math.max(0, Math.ceil(prefs.sec - idle)));
      if (frac >= 1) expire();
    }, 100);
    return () => {
      window.clearInterval(id);
      ta.style.removeProperty("--fade");
    };
  }, [prefs.mode, prefs.sec, hasText]);

  // ───────────────────────── 콤보 ─────────────────────────

  function endCombo() {
    const L = live.current;
    window.clearTimeout(L.comboTimer);
    L.combo = 0;
    L.hits.length = 0;
    if (comboRef.current) comboRef.current.dataset.on = "";
    if (L.fever) {
      L.fever = false;
      delete rootRef.current?.dataset.fever;
      if (fx.current) fx.current.fever = false;
      if (grove.current) grove.current.fever = false;
    }
  }

  /** 지금 점수 배율: 콤보 25마다 한 단계, 폭주 중에는 두 배. */
  function mult() {
    const L = live.current;
    return Math.min(8, 1 + Math.floor(L.combo / 25)) * (L.fever ? 2 : 1);
  }

  function callout(text: string, ms = 1500) {
    const el = calloutRef.current;
    if (!el) return;
    el.textContent = text;
    el.animate(
      [
        { opacity: 0, transform: "scale(2.4) rotate(-9deg)" },
        { opacity: 1, transform: "scale(1) rotate(-4deg)", offset: 0.2 },
        { opacity: 1, transform: "scale(1) rotate(-4deg)", offset: 0.82 },
        { opacity: 0, transform: "scale(.92) rotate(-4deg) translateY(-10px)" },
      ],
      { duration: ms, easing: "cubic-bezier(.2,1.2,.4,1)" },
    );
  }

  function startFever() {
    const L = live.current;
    const engine = fx.current;
    const num = comboNumRef.current;
    if (!engine || L.fever) return;
    L.fever = true;
    if (rootRef.current) rootRef.current.dataset.fever = "1";
    engine.fever = true;
    if (grove.current) {
      grove.current.fever = true;
      grove.current.flare();
    }
    if (!engine.reduced) {
      callout("폭주 모드! 점수 2배", 1900);
      if (num) {
        const r = num.getBoundingClientRect();
        engine.burst(r.left + r.width / 2, r.top + r.height / 2, 1.4);
      }
      engine.party(0.35);
      engine.trauma = Math.min(1, engine.trauma + 0.55);
    }
    sfx.current?.fever();
    navigator.vibrate?.([20, 30, 20, 30, 60]);
  }

  function showCombo() {
    const L = live.current;
    const box = comboRef.current;
    const num = comboNumRef.current;
    const engine = fx.current;
    if (!box || !num || !engine || L.combo < 5) return;
    box.dataset.on = "1";
    num.textContent = String(L.combo);
    const m = mult();
    if (multRef.current) multRef.current.textContent = m > 1 ? `×${m}` : "";
    if (engine.reduced) return;
    num.animate([{ transform: "scale(1.34)" }, { transform: "scale(1)" }], {
      duration: 150,
      easing: "cubic-bezier(.2,1.5,.4,1)",
    });
    const tier = TIERS.findIndex(([n]) => n === L.combo);
    if (tier < 0) return;
    callout(TIERS[tier][1]);
    grove.current?.flare(0.8);
    const r = num.getBoundingClientRect();
    engine.burst(r.left + r.width / 2, r.top + r.height / 2, tier / 4);
    engine.trauma = Math.min(1, engine.trauma + 0.3);
    sfx.current?.tier(tier);
  }

  /** 글자 하나를 칠 때마다: 콤보, 열기, 스파크, 타건음. */
  function hit(ta: HTMLTextAreaElement) {
    const L = live.current;
    const engine = fx.current;
    if (!engine) return;
    const now = performance.now();
    L.combo += 1;
    if (L.combo > L.peak) L.peak = L.combo;
    L.hits.push(now);
    while (L.hits.length && L.hits[0] < now - 1000) L.hits.shift();

    const speed = clamp((L.hits.length - 4) / 9);
    const heat = clamp(speed * 0.72 + Math.min(1, L.combo / 240) * 0.28);
    engine.heatTarget = Math.max(engine.heatTarget, heat);

    const at = hotAt(ta.value, ta.selectionEnd);
    const hot = at >= 0 && at !== L.hot;
    L.hot = at;
    if (!L.fever && L.combo >= FEVER_AT) startFever();

    // 점수: 타자 한 번에 10점 × 배율, 크리티컬은 보너스.
    const m = mult();
    const bonus = hot ? CRIT_BONUS * m : 0;
    L.score += 10 * m + bonus;
    setScore(L.score);

    if (hot) {
      L.crits += 1;
      engine.heatTarget = Math.min(1, engine.heatTarget + 0.35);
      engine.trauma = Math.min(1, engine.trauma + 0.5);
      grove.current?.flare(0.6);
      navigator.vibrate?.(16);
    } else {
      engine.trauma = Math.min(0.6, engine.trauma + 0.015 + heat * 0.075);
    }
    grove.current?.kick(0.24 + heat * 0.5);
    if (!engine.reduced) {
      const p = caretPoint(ta);
      if (p) {
        engine.spark(p.x, p.y + p.h * 0.55, hot);
        if (hot) engine.say(`+${bonus.toLocaleString("ko-KR")}`, p.x + 14, p.y - 66, CYAN, 26);
      }
      // 타건마다 글이 살짝 눌렸다 올라오고, 크리티컬에는 색이 갈라집니다.
      ta.animate(
        hot
          ? [
              {
                transform: "scale(1.012)",
                textShadow: "-4px 0 0 rgb(255 45 85 / .95), 4px 0 0 rgb(64 224 255 / .95)",
              },
              { transform: "none", textShadow: "0 0 0 rgb(255 45 85 / 0), 0 0 0 rgb(64 224 255 / 0)" },
            ]
          : [{ transform: "translateY(1.5px)" }, { transform: "none" }],
        { duration: hot ? 240 : 70, easing: "ease-out" },
      );
    }
    engine.kick();
    sfx.current?.key(L.combo, hot);
    showCombo();
    window.clearTimeout(L.comboTimer);
    L.comboTimer = window.setTimeout(endCombo, 1700);
  }

  // ───────────────────────── 날려버리기 ─────────────────────────

  function showStamp(s: Omit<Stamp, "id">) {
    const L = live.current;
    setBusy(false);
    setStamp({ ...s, id: performance.now() });
    window.clearTimeout(L.stampTimer);
    L.stampTimer = window.setTimeout(() => setStamp(null), s.quiet ? 1900 : 3700);
  }

  function wipe() {
    const L = live.current;
    setText("");
    clearDraft();
    L.peak = 0;
    L.hot = -1;
    L.score = 0;
    L.crits = 0;
    setScore(0);
    endCombo();
  }

  function destroy(kind: Kind) {
    const ta = taRef.current;
    const engine = fx.current;
    if (!ta || !engine) return;
    const value = ta.value;
    if (!value.trim()) {
      if (value) wipe();
      return;
    }
    // 연출에 쓸 글자 위치만 떠 두고, 원문은 그 즉시 지웁니다.
    const snap = disguised ? null : snapshot(ta, kind === "vapor" ? 0.28 : 1);
    const n = countChars(value);
    const { peak, score: points, crits } = live.current;
    wipe();
    const after = bumpTally(n, peak, points);
    if (disguised || !snap) return;

    const power = clamp(n / FULL, 0.12, 1);
    let level = 0;
    RANKS.forEach((r, i) => {
      if (points >= r.min) level = i;
    });
    const verb = EFFECTS.find((e) => e.id === kind)?.verb ?? "";
    setStamp(null);
    setBusy(true);

    const duration = engine.play(kind, snap, power, () => {
      if (kind === "vapor") {
        showStamp({ quiet: true, main: "증발했습니다", sub: "", foot: "" });
        return;
      }
      const extras = [peak >= 30 ? `최고 ${peak}콤보` : "", crits ? `크리티컬 ${crits}번` : ""].filter(Boolean);
      showStamp({
        quiet: false,
        rank: RANKS[level].id,
        score: points,
        record: after.record,
        main: `${n.toLocaleString("ko-KR")}자 ${verb}!`,
        sub: RANKS[level].say,
        foot: `오늘 ${after.count}번의 화를 참아냈습니다.${extras.length ? ` ${extras.join(", ")}.` : ""}`,
      });
      // 피날레: 랭크 도장, 색종이, 치솟는 대숲.
      sfx.current?.rank(level);
      grove.current?.flare();
      engine.party(0.25 + level * 0.15);
      if (level >= 3) engine.trauma = Math.min(1, engine.trauma + 0.4);
    });

    const audio = sfx.current;
    if (audio) {
      if (kind === "shred") audio.shred(duration);
      else if (kind === "burn") audio.burn(duration);
      else if (kind === "hole") audio.hole(duration);
      else if (kind === "blast") audio.blast(duration, power);
      else audio.vapor();
      if (kind === "shred" || kind === "burn") audio.boom(power);
    }
    if (kind !== "vapor") navigator.vibrate?.([24, 40, 70]);
    ta.focus({ preventScroll: true });
  }

  // ───────────────────────── 입력 ─────────────────────────

  function onChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const v = ta.value;
    setText(v);
    if (stamp) setStamp(null);
    if (busy) setBusy(false);
    live.current.lastInput = performance.now();
    if (prefs.mode === "tab") saveDraft(v);
    if (!v) {
      wipe();
      return;
    }
    const type = (e.nativeEvent as InputEvent).inputType || "";
    if (type.startsWith("delete") || type.startsWith("history")) return;
    hit(ta);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    // 한글 조합 중의 Enter는 글자를 확정하는 용도라 건드리지 않습니다.
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229 || e.shiftKey) return;
    if (touch && !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault();
    destroy(prefs.effect);
  }

  function setMode(mode: Mode) {
    prefsStore.set({ ...prefs, mode });
    live.current.lastInput = performance.now();
    if (mode === "tab") saveDraft(text);
    else clearDraft();
    taRef.current?.focus({ preventScroll: true });
  }

  function toggleSound() {
    const sound = !prefs.sound;
    prefsStore.set({ ...prefs, sound });
    sfx.current?.setOn(sound);
    if (sound) sfx.current?.chime(1);
  }

  const modeHint =
    prefs.mode === "now"
      ? touch
        ? "버튼을 누르면 날아갑니다. 새로고침만 해도 사라집니다."
        : "버튼이나 Enter로 날립니다. 새로고침만 해도 사라집니다."
      : prefs.mode === "timer"
        ? hasText
          ? `${left || prefs.sec}초 뒤 증발합니다. 계속 쓰면 다시 셉니다.`
          : `손을 멈추면 ${SECS.find((s) => s.id === prefs.sec)?.label} 뒤에 증발합니다.`
        : "새로고침해도 남아 있고, 탭을 닫으면 사라집니다.";

  return (
    <>
      <div
        className="app"
        ref={rootRef}
        hidden={disguised}
        data-full={gauge >= 1 ? "1" : undefined}
        style={{ "--g": gauge } as React.CSSProperties}
      >
        <canvas ref={groveRef} className="grove" aria-hidden="true" />
        <div className="shell" ref={shellRef}>
          <header className="top">
            <span className="mark">
              <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
                <rect x="5" y="3" width="5.5" height="10" fill="currentColor" />
                <rect x="5" y="15" width="5.5" height="14" fill="currentColor" />
                <rect x="13.25" y="3" width="5.5" height="15" fill="var(--color-sun)" />
                <rect x="13.25" y="20" width="5.5" height="6.5" fill="var(--color-ember)" />
                <rect x="21.5" y="3" width="5.5" height="6.5" fill="currentColor" />
                <rect x="21.5" y="11.5" width="5.5" height="12" fill="currentColor" />
              </svg>
              휘발
            </span>
            <p className="tally" aria-live="polite">
              {tally.count > 0 ? (
                <>
                  오늘 <b>{tally.count}</b>번<span className="long">의 화를 참아냈습니다</span>
                </>
              ) : (
                <span className="long">오늘은 아직 조용합니다</span>
              )}
            </p>
            <div className="tools">
              <button type="button" className="chip" role="switch" aria-checked={prefs.sound} onClick={toggleSound}>
                소리 {prefs.sound ? "켜짐" : "꺼짐"}
              </button>
              <button
                type="button"
                className="chip"
                onClick={() => setDisguised(true)}
                title="Esc를 두 번 눌러도 됩니다"
              >
                위장
              </button>
            </div>
          </header>

          <main className="stage">
            <textarea
              ref={taRef}
              className="vent-text"
              value={text}
              onChange={onChange}
              onKeyDown={onKeyDown}
              aria-label="털어놓을 말"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
            />

            {!hasText && !busy && !stamp && (
              <div className="hello" aria-hidden="true">
                <h1>
                  참지 말고 쏟아내세요.
                  <span>어차피 흔적 없이 날아갑니다.</span>
                </h1>
                <p>
                  {touch
                    ? "다 썼으면 아래 버튼으로 날려버리세요. 누가 오면 오른쪽 위 ‘위장’을 누르면 업무 화면으로 바뀝니다."
                    : "Enter를 누르면 날아갑니다. 줄을 바꾸려면 Shift+Enter, 누가 오면 Esc를 두 번 누르세요."}
                </p>
              </div>
            )}

            <div className="combo" ref={comboRef} aria-hidden="true">
              <span ref={comboNumRef} />
              <em>콤보</em>
              <u ref={multRef} />
              <i ref={calloutRef} />
            </div>

            {stamp && (
              <div className={stamp.quiet ? "echo" : "stamp"} key={stamp.id} role="status" data-rank={stamp.rank}>
                {stamp.rank && <b>{stamp.rank}</b>}
                <strong>{stamp.main}</strong>
                {stamp.score !== undefined && (
                  <p>
                    <CountUp to={stamp.score} />점{stamp.record && <mark>신기록!</mark>}
                  </p>
                )}
                {stamp.sub && <em>{stamp.sub}</em>}
                {stamp.foot && <small>{stamp.foot}</small>}
              </div>
            )}
          </main>

          <div className="gauge" aria-hidden="true">
            <div className="rail">
              <div className="fill" />
            </div>
            <output>
              {score > 0 && <b>{score.toLocaleString("ko-KR")}점</b>}
              {chars > 0 ? `${chars.toLocaleString("ko-KR")}자 장전` : "장전된 글자 없음"}
            </output>
          </div>

          <footer className="dock">
            <div className="seg" role="radiogroup" aria-label="사라지는 시점">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={prefs.mode === m.id}
                  onClick={() => setMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {prefs.mode === "timer" && (
              <div className="seg" role="radiogroup" aria-label="증발까지 걸리는 시간">
                {SECS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={prefs.sec === s.id}
                    onClick={() => {
                      prefsStore.set({ ...prefs, sec: s.id });
                      live.current.lastInput = performance.now();
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            <div className="seg" role="radiogroup" aria-label="날리는 방식">
              {EFFECTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={prefs.effect === f.id}
                  onClick={() => prefsStore.set({ ...prefs, effect: f.id })}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="hint">{modeHint}</p>
            <button type="button" className="fire" disabled={!hasText} onClick={() => destroy(prefs.effect)}>
              날려버리기
              <kbd>Enter</kbd>
            </button>
          </footer>

          <p className="vow">
            입력한 내용은 서버에 저장되지 않으며, 날려버린 즉시 복구할 수 없습니다.{" "}
            <a href="/privacy/">어떻게 믿나요?</a>
          </p>
        </div>
      </div>

      <canvas ref={cvRef} className="fx" aria-hidden="true" hidden={disguised} />
      {disguised && <Disguise onExit={() => setDisguised(false)} />}
    </>
  );
}
