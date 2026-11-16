// 브라우저에만 남기는 것들. 글 내용은 여기 어디에도 넣지 않습니다.
// 예외는 "탭 닫으면 증발" 모드 하나로, 그때만 sessionStorage에 임시로 둡니다.

export type Mode = "now" | "timer" | "tab";
export type Effect = "shred" | "burn" | "hole";
export type Prefs = { mode: Mode; sec: 10 | 30 | 60; effect: Effect; sound: boolean };
export type Tally = { day: string; count: number; chars: number; best: number; total: number };

const PREFS_KEY = "hwibal:prefs";
const TALLY_KEY = "hwibal:tally";
const DRAFT_KEY = "hwibal:draft";

const DEFAULT_PREFS: Prefs = { mode: "now", sec: 10, effect: "shred", sound: false };
const EMPTY_TALLY: Tally = { day: "", count: 0, chars: 0, best: 0, total: 0 };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** React의 useSyncExternalStore에 물릴 수 있는 아주 작은 저장소. */
function createStore<T>(key: string, initial: T, parse: (raw: unknown) => T) {
  let value: T | undefined;
  const subs = new Set<() => void>();
  return {
    subscribe(cb: () => void) {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    get(): T {
      if (value === undefined) {
        try {
          value = parse(JSON.parse(localStorage.getItem(key) || "null"));
        } catch {
          value = initial;
        }
      }
      return value;
    },
    getServer: (): T => initial,
    set(next: T) {
      value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      subs.forEach((f) => f());
    },
  };
}

type Loose = Record<string, unknown> | null;

/** 모드·효과·소리 같은 설정. */
export const prefsStore = createStore<Prefs>(PREFS_KEY, DEFAULT_PREFS, (raw) => {
  const r = (raw as Loose) ?? {};
  return {
    mode: (["now", "timer", "tab"] as const).find((m) => m === r.mode) ?? DEFAULT_PREFS.mode,
    sec: ([10, 30, 60] as const).find((s) => s === r.sec) ?? DEFAULT_PREFS.sec,
    effect: (["shred", "burn", "hole"] as const).find((e) => e === r.effect) ?? DEFAULT_PREFS.effect,
    sound: r.sound === true,
  };
});

/** 오늘 몇 번 날렸는지. 숫자만 저장하고, 날짜가 바뀌면 오늘 치는 0부터 다시 셉니다. */
export const tallyStore = createStore<Tally>(TALLY_KEY, EMPTY_TALLY, (raw) => {
  const r = (raw as Loose) ?? {};
  const day = today();
  const total = Number(r.total) || 0;
  if (r.day !== day) return { ...EMPTY_TALLY, day, total };
  return {
    day,
    count: Number(r.count) || 0,
    chars: Number(r.chars) || 0,
    best: Number(r.best) || 0,
    total,
  };
});

export function bumpTally(chars: number, combo: number): Tally {
  const t = tallyStore.get();
  const day = today();
  const base = t.day === day ? t : { ...EMPTY_TALLY, day, total: t.total };
  const next: Tally = {
    day,
    count: base.count + 1,
    chars: base.chars + chars,
    best: Math.max(base.best, combo),
    total: base.total + 1,
  };
  tallyStore.set(next);
  return next;
}

/**
 * "탭 닫으면 증발" 모드의 임시 글. 새로고침일 때만 되살립니다.
 * 닫은 탭을 다시 열거나 세션을 복원한 경우에는 브라우저가 sessionStorage를 되돌려 놓더라도 버립니다.
 */
export function loadDraft(): string {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const text = nav?.type === "reload" ? sessionStorage.getItem(DRAFT_KEY) || "" : "";
    if (!text) sessionStorage.removeItem(DRAFT_KEY);
    return text;
  } catch {
    return "";
  }
}

export function saveDraft(text: string) {
  try {
    if (text) sessionStorage.setItem(DRAFT_KEY, text);
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {}
}
