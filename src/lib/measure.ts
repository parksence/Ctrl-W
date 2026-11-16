// 입력창 안 글자들의 실제 화면 좌표를 잽니다.
// 입력창과 똑같은 모양의 보이지 않는 복제본을 잠깐 만들어 재고, 잰 뒤에는 내용을 바로 비웁니다.

import type { Glyph, Snap } from "./fx";

let mirror: HTMLDivElement | null = null;

function place(ta: HTMLTextAreaElement) {
  if (!mirror) {
    mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    document.body.appendChild(mirror);
  }
  const rect = ta.getBoundingClientRect();
  mirror.className = "vent-text";
  const s = mirror.style;
  s.position = "fixed";
  s.left = `${rect.left}px`;
  s.top = `${rect.top}px`;
  s.width = `${ta.clientWidth}px`;
  s.margin = "0";
  s.visibility = "hidden";
  s.pointerEvents = "none";
  s.zIndex = "-1";
  s.opacity = "1";
  return { m: mirror, rect };
}

/** 커서가 지금 화면 어디에 있는지. 스파크가 튀어나올 자리입니다. */
export function caretPoint(ta: HTMLTextAreaElement): { x: number; y: number; h: number } | null {
  const { m, rect } = place(ta);
  m.style.height = "auto";
  m.style.overflow = "visible";
  m.textContent = ta.value.slice(0, ta.selectionEnd ?? ta.value.length);
  const marker = document.createElement("span");
  marker.textContent = "​";
  m.appendChild(marker);
  const r = marker.getBoundingClientRect();
  m.textContent = "";
  if (!r.height) return null;
  const y = r.top - ta.scrollTop;
  return {
    x: Math.min(rect.right, Math.max(rect.left, r.left)),
    y: Math.min(rect.bottom - r.height, Math.max(rect.top, y)),
    h: r.height,
  };
}

/** 화면에 보이는 글자 하나하나의 위치를 떠 둡니다. 날려버리는 연출의 재료입니다. */
export function snapshot(ta: HTMLTextAreaElement, alpha = 1): Snap | null {
  const value = ta.value;
  if (!value.trim()) return null;
  const { m, rect } = place(ta);
  m.style.height = `${ta.clientHeight}px`;
  m.style.overflow = "hidden";
  m.textContent = value;
  m.scrollTop = ta.scrollTop;
  const node = m.firstChild as Text;
  const range = document.createRange();

  const segs: { i: number; s: string }[] = [];
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("ko", { granularity: "grapheme" });
    for (const { segment, index } of seg.segment(value)) {
      if (segment.trim()) segs.push({ i: index, s: segment });
    }
  } else {
    let i = 0;
    for (const ch of value) {
      if (ch.trim()) segs.push({ i, s: ch });
      i += ch.length;
    }
  }

  const rectOf = (k: number) => {
    range.setStart(node, segs[k].i);
    range.setEnd(node, segs[k].i + segs[k].s.length);
    return range.getBoundingClientRect();
  };

  // 긴 글이면 화면에 보이는 구간만 잽니다.
  const top = rect.top - 48;
  const bottom = rect.bottom + 48;
  let lo = 0;
  let hi = segs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rectOf(mid).bottom < top) lo = mid + 1;
    else hi = mid;
  }

  const glyphs: Glyph[] = [];
  const box = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
  for (let k = lo; k < segs.length && glyphs.length < 5000; k++) {
    const q = rectOf(k);
    if (q.top > bottom) break;
    if (!q.width) continue;
    glyphs.push({ ch: segs[k].s, x: q.left, y: q.top, w: q.width, h: q.height });
    if (q.left < box.l) box.l = q.left;
    if (q.top < box.t) box.t = q.top;
    if (q.right > box.r) box.r = q.right;
    if (q.bottom > box.b) box.b = q.bottom;
  }
  m.textContent = "";
  if (!glyphs.length) return null;

  const cs = getComputedStyle(ta);
  return {
    glyphs,
    font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`,
    color: cs.color,
    alpha,
    area: { l: rect.left, t: rect.top, r: rect.right, b: rect.bottom },
    box,
  };
}
