import { bunchRows } from "@/lib/grapes";
import { skinForIndex, type GrapeSkin } from "@/lib/skins";

export interface ShareCardOpts {
  /** 포도알(=완성 알) 총 개수 */
  totalGrapes: number;
  skin: GrapeSkin;
  /** 랜덤 포도용 — 가진 스킨 id 목록 (2개 이상이면 알마다 다른 스킨) */
  randomPoolIds?: string[];
  title: string;
  memberName: string;
  groupName: string;
  /** "2026년 7월 21일 완성" 같은 문구 */
  dateText: string;
}

const W = 1080;
const H = 1350;

/** 텍스트를 최대 폭에 맞춰 잘라 말줄임 */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1);
  return t + "…";
}

/** 포도알 한 알 그리기 (스킨 색 radial + 테두리 + 광택) */
function drawBerry(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, skin: GrapeSkin) {
  const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.1, cx, cy, r);
  skin.colors.forEach((c, i) => grad.addColorStop(i / (skin.colors.length - 1), c));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.strokeStyle = skin.stroke;
  ctx.stroke();
  // 광택
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.28, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin.gloss;
  ctx.globalAlpha = 0.8;
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * 완성 포도송이 자랑 카드를 캔버스에 그린다 (1080×1350, 세로 — 스토리/단톡 공유용).
 * 고른 스킨 색이 그대로 반영된다.
 */
export function drawShareCard(canvas: HTMLCanvasElement, opts: ShareCardOpts): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 배경 그라데이션
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#f5f3ff");
  bg.addColorStop(1, "#ede9fe");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const centerX = W / 2;

  // 그룹 이름 (상단)
  ctx.textAlign = "center";
  ctx.fillStyle = "#7c3aed";
  ctx.font = "bold 40px system-ui, 'Malgun Gothic', sans-serif";
  ctx.fillText(fitText(ctx, opts.groupName, W - 160), centerX, 110);

  // 포도송이 그리기 (중앙 상단 영역)
  const rows = bunchRows(opts.totalGrapes);
  const maxRow = Math.max(...rows, 1);
  const areaW = W * 0.66;
  const gap = 12;
  // 알 반지름을 가장 넓은 행이 areaW에 맞도록 계산 (상한 60)
  const r = Math.min(60, (areaW - (maxRow - 1) * gap) / (maxRow * 2));
  const dx = r * 2 + gap;
  const dy = r * 2 - r * 0.22;
  const stemTop = 250;
  const berryTop = stemTop + 70 + r;

  // 줄기
  ctx.strokeStyle = "#854d0e";
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(centerX, stemTop);
  ctx.quadraticCurveTo(centerX + 10, stemTop + 35, centerX, stemTop + 70);
  ctx.stroke();
  // 잎
  ctx.fillStyle = "#4ade80";
  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(centerX, stemTop + 25);
  ctx.quadraticCurveTo(centerX + 65, stemTop - 15, centerX + 100, stemTop + 30);
  ctx.quadraticCurveTo(centerX + 50, stemTop + 65, centerX, stemTop + 25);
  ctx.fill();
  ctx.stroke();

  // 알 배치 — 랜덤 포도면 화면과 똑같이 인덱스로 스킨을 고른다
  const pool = opts.randomPoolIds ?? [];
  const skinAt = (index: number) => (pool.length > 1 ? skinForIndex(pool, index) : opts.skin);
  let berryIdx = 0;
  rows.forEach((count, rowIdx) => {
    const rowWidth = count * dx;
    const startX = centerX - rowWidth / 2 + dx / 2;
    for (let i = 0; i < count; i++, berryIdx++) {
      drawBerry(ctx, startX + i * dx, berryTop + rowIdx * dy, r, skinAt(berryIdx + 1));
    }
  });

  const bunchBottom = berryTop + rows.length * dy + r;

  // 곡 제목
  ctx.fillStyle = "#4c1d95";
  ctx.font = "bold 68px system-ui, 'Malgun Gothic', sans-serif";
  ctx.fillText(fitText(ctx, `🏆 ${opts.title}`, W - 120), centerX, bunchBottom + 110);

  // 성과 문구
  ctx.fillStyle = "#6d28d9";
  ctx.font = "bold 48px system-ui, 'Malgun Gothic', sans-serif";
  ctx.fillText(`🍇 포도알 ${opts.totalGrapes}알 완성!`, centerX, bunchBottom + 185);

  // 멤버 · 날짜
  ctx.fillStyle = "#7c6f9b";
  ctx.font = "36px system-ui, 'Malgun Gothic', sans-serif";
  ctx.fillText(fitText(ctx, `${opts.memberName} · ${opts.dateText}`, W - 120), centerX, bunchBottom + 250);

  // 하단 브랜딩
  ctx.fillStyle = "#a78bfa";
  ctx.font = "bold 40px system-ui, 'Malgun Gothic', sans-serif";
  ctx.fillText("🍇 GrapeNote", centerX, H - 70);
}
