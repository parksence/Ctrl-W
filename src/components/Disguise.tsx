"use client";

// 위장 화면: 누가 다가오면 Esc 두 번으로 띄우는, 평범한 예산 스프레드시트.
// 특정 제품을 흉내 내지 않은 일반적인 표 화면이고, 셀 선택과 입력이 실제로 됩니다.

import { useEffect, useRef, useState } from "react";

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
const ROWS = 34;
const FIRST = 5;

type Cell = { v: string; f?: string; cls?: string };

const DATA: [string, string, number, number, string, string][] = [
  ["경영지원팀", "복리후생비", 48000, 39120, "김 과장", ""],
  ["경영지원팀", "소모품비", 12000, 9870, "김 과장", ""],
  ["경영지원팀", "교육훈련비", 18000, 7450, "박 대리", "12월 집합교육 예정"],
  ["인사팀", "채용광고비", 24000, 21300, "최 과장", ""],
  ["인사팀", "교육훈련비", 36000, 28940, "최 과장", ""],
  ["인사팀", "행사비", 15000, 14200, "윤 대리", "송년회 선집행"],
  ["재무팀", "지급수수료", 30000, 26410, "정 차장", ""],
  ["재무팀", "감사비용", 22000, 22000, "정 차장", "집행 완료"],
  ["영업1팀", "접대비", 42000, 40880, "이 과장", "추경 요청"],
  ["영업1팀", "출장비", 38000, 31250, "이 과장", ""],
  ["영업1팀", "판촉비", 55000, 47600, "한 대리", ""],
  ["영업2팀", "접대비", 36000, 29300, "조 과장", ""],
  ["영업2팀", "출장비", 32000, 27840, "조 과장", ""],
  ["마케팅팀", "광고선전비", 120000, 98700, "강 차장", "12월 캠페인 반영 전"],
  ["마케팅팀", "행사비", 45000, 45000, "강 차장", "집행 완료"],
  ["마케팅팀", "외주용역비", 60000, 41500, "서 대리", ""],
  ["개발팀", "클라우드 이용료", 180000, 171240, "임 과장", "11월 정산 예정"],
  ["개발팀", "소프트웨어 라이선스", 64000, 58300, "임 과장", "계약 갱신(12월)"],
  ["개발팀", "외주용역비", 90000, 52000, "오 대리", ""],
];

const won = (n: number) => n.toLocaleString("ko-KR");

function build(): Record<string, Cell> {
  const cells: Record<string, Cell> = {
    A1: { v: "2026년 4분기 부서별 예산 집행 현황", cls: "t" },
    A2: { v: "단위: 천원 / 11월 13일 마감 기준", cls: "m" },
  };
  ["부서", "계정과목", "예산", "집행", "잔액", "집행률", "담당", "비고"].forEach((h, i) => {
    cells[`${COLS[i]}${FIRST - 1}`] = { v: h, cls: "h" };
  });
  let budget = 0;
  let spent = 0;
  DATA.forEach(([dept, item, b, s, owner, note], i) => {
    const r = FIRST + i;
    budget += b;
    spent += s;
    cells[`A${r}`] = { v: dept };
    cells[`B${r}`] = { v: item };
    cells[`C${r}`] = { v: won(b), cls: "n" };
    cells[`D${r}`] = { v: won(s), cls: "n" };
    cells[`E${r}`] = { v: won(b - s), f: `=C${r}-D${r}`, cls: "n" };
    cells[`F${r}`] = { v: `${((s / b) * 100).toFixed(1)}%`, f: `=D${r}/C${r}`, cls: s / b > 0.95 ? "n w" : "n" };
    cells[`G${r}`] = { v: owner };
    cells[`H${r}`] = { v: note, cls: "m" };
  });
  const last = FIRST + DATA.length - 1;
  const sum = last + 1;
  cells[`A${sum}`] = { v: "합계", cls: "s" };
  cells[`B${sum}`] = { v: "", cls: "s" };
  cells[`C${sum}`] = { v: won(budget), f: `=SUM(C${FIRST}:C${last})`, cls: "n s" };
  cells[`D${sum}`] = { v: won(spent), f: `=SUM(D${FIRST}:D${last})`, cls: "n s" };
  cells[`E${sum}`] = { v: won(budget - spent), f: `=C${sum}-D${sum}`, cls: "n s" };
  cells[`F${sum}`] = { v: `${((spent / budget) * 100).toFixed(1)}%`, f: `=D${sum}/C${sum}`, cls: "n s" };
  cells[`G${sum}`] = { v: "", cls: "s" };
  cells[`H${sum}`] = { v: "", cls: "s" };
  return cells;
}

const BASE = build();

const ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='5' fill='#2f6f55'/><path d='M7 9h18v14H7z' fill='#fff'/><path d='M7 13.6h18M7 18.3h18M13 9v14M19 9v14' stroke='#2f6f55' stroke-width='1.4'/></svg>",
  );
const FILE = "4분기_예산집행현황_v3.xlsx";

export default function Disguise({ onExit }: { onExit: () => void }) {
  const base = BASE;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [sel, setSel] = useState({ r: 9, c: 3 });
  const [draft, setDraft] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const taps = useRef<number[]>([]);

  const key = `${COLS[sel.c]}${sel.r}`;
  const shown = (k: string) => edits[k] ?? base[k]?.v ?? "";
  const formula = draft ?? edits[key] ?? base[key]?.f ?? base[key]?.v ?? "";

  // 탭 제목과 아이콘도 업무 파일처럼 바꿔 둡니다.
  useEffect(() => {
    const title = document.title;
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    const hrefs = links.map((l) => l.href);
    document.title = FILE;
    links.forEach((l) => (l.href = ICON));
    gridRef.current?.focus();
    return () => {
      document.title = title;
      links.forEach((l, i) => (l.href = hrefs[i]));
    };
  }, []);

  const move = (dr: number, dc: number) =>
    setSel((s) => ({
      r: Math.min(ROWS, Math.max(1, s.r + dr)),
      c: Math.min(COLS.length - 1, Math.max(0, s.c + dc)),
    }));

  const commit = (dr: number, dc: number) => {
    if (draft !== null) setEdits((e) => ({ ...e, [key]: draft }));
    setDraft(null);
    move(dr, dc);
    gridRef.current?.focus();
  };

  function onGridKey(e: React.KeyboardEvent) {
    if (draft !== null) return;
    if (e.key === "ArrowUp") move(-1, 0);
    else if (e.key === "ArrowDown" || e.key === "Enter") move(1, 0);
    else if (e.key === "ArrowLeft") move(0, -1);
    else if (e.key === "ArrowRight" || e.key === "Tab") move(0, 1);
    else if (e.key === "Delete" || e.key === "Backspace") setEdits((x) => ({ ...x, [key]: "" }));
    else if (e.key === "F2") setDraft(shown(key));
    else if (e.key === "Process") return setDraft("");
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) setDraft(e.key);
    else return;
    e.preventDefault();
  }

  // 터치 기기에는 Esc가 없으니 파일 이름을 빠르게 세 번 누르면 돌아갑니다.
  function onTitleTap() {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 900), now];
    if (taps.current.length >= 3) onExit();
  }

  return (
    <div className="dz">
      <div className="dz-bar">
        <span className="dz-icon" aria-hidden="true" />
        <button type="button" className="dz-file" onClick={onTitleTap}>
          {FILE}
        </button>
        <span className="dz-saved">저장됨</span>
      </div>
      <div className="dz-menu">
        {["파일", "홈", "삽입", "수식", "데이터", "검토", "보기"].map((m) => (
          <span key={m} className={m === "홈" ? "on" : undefined}>
            {m}
          </span>
        ))}
      </div>
      <div className="dz-tools" aria-hidden="true">
        <span className="box wide">맑은 고딕</span>
        <span className="box">11</span>
        <span className="btn b">가</span>
        <span className="btn i">가</span>
        <span className="btn u">가</span>
        <span className="sep" />
        <span className="btn">왼쪽</span>
        <span className="btn">가운데</span>
        <span className="btn">오른쪽</span>
        <span className="sep" />
        <span className="btn">₩</span>
        <span className="btn">%</span>
        <span className="btn">,</span>
        <span className="sep" />
        <span className="btn">자동 합계</span>
        <span className="btn">정렬 및 필터</span>
      </div>
      <div className="dz-fx">
        <span className="name">{key}</span>
        <span className="fx-mark">fx</span>
        <span className="val">{formula}</span>
      </div>

      <div className="dz-grid" ref={gridRef} tabIndex={0} onKeyDown={onGridKey}>
        <table>
          <colgroup>
            <col style={{ width: 44 }} />
            {COLS.map((c, i) => (
              <col key={c} style={{ width: [104, 150, 96, 96, 96, 76, 84, 190][i] ?? 88 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th />
              {COLS.map((c, i) => (
                <th key={c} className={i === sel.c ? "on" : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, ri) => {
              const r = ri + 1;
              return (
                <tr key={r}>
                  <th className={r === sel.r ? "on" : undefined}>{r}</th>
                  {COLS.map((c, ci) => {
                    const k = `${c}${r}`;
                    const active = r === sel.r && ci === sel.c;
                    return (
                      <td
                        key={k}
                        className={[base[k]?.cls, active ? "sel" : ""].filter(Boolean).join(" ") || undefined}
                        onMouseDown={() => {
                          if (draft !== null) setEdits((e) => ({ ...e, [key]: draft }));
                          setDraft(null);
                          setSel({ r, c: ci });
                        }}
                        onDoubleClick={() => setDraft(shown(k))}
                      >
                        {active && draft !== null ? (
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.nativeEvent.isComposing) return;
                              if (e.key === "Enter") commit(1, 0);
                              else if (e.key === "Tab") {
                                e.preventDefault();
                                commit(0, 1);
                              } else if (e.key === "Escape") {
                                setDraft(null);
                                gridRef.current?.focus();
                              }
                            }}
                            onBlur={() => {
                              setEdits((x) => ({ ...x, [key]: draft }));
                              setDraft(null);
                            }}
                          />
                        ) : (
                          shown(k)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="dz-foot">
        <span className="tab on">집행현황</span>
        <span className="tab">월별추이</span>
        <span className="tab">부서코드</span>
        <span className="ready">준비</span>
      </div>
    </div>
  );
}
