// src/report/generatePdf.ts

import { jsPDF } from "jspdf";
import type { SessionSummary, QuestionAttempt } from "./sessionLog";

// ─── Color palette ───────────────────────────────────────────────────────────

const COLORS = {
  headerBg: "#f1f5f9",       // light slate for header + curriculum bg
  headerBorder: "#cbd5e1",   // border for header
  correctBg: "#f0fdf4",
  correctBorder: "#22c55e",
  correctDark: "#16a34a",    // darker green for "Your answer" when correct
  wrongBg: "#fff5f5",
  wrongBorder: "#ef4444",
  accentPurple: "#a855f7",
  textDark: "#1e293b",
  textMuted: "#64748b",
};

// ─── Curriculum metadata (mirrors manifest teachesLevels) ────────────────────

const CURRICULUM_LEVELS = [
  {
    code: "MA3-7NA",
    stageLabel: "Stage 3 (Years 5-6)",
    syllabusUrl: "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
    description: "Compares, orders and calculates with fractions, decimals and percentages.",
    levelDesc: "Level 1 - Adding decimal distances across multiple road segments to find a total journey distance",
  },
  {
    code: "MA3-7NA",
    stageLabel: "Stage 3 (Years 5-6)",
    syllabusUrl: "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
    description: "Compares, orders and calculates with fractions, decimals and percentages.",
    levelDesc: "Level 2 - Subtraction of decimals with a missing segment shown as \"?\"",
  },
  {
    code: "MA3-9MG",
    stageLabel: "Stage 3 (Years 5-6)",
    syllabusUrl: "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
    description: "Selects and uses appropriate unit and device to measure lengths and distances, calculates perimeters, and converts between units of length.",
    levelDesc: "Level 3 - Comparison of two distances from a common point with three scaffolded input rows",
  },
];

// ─── Text sanitiser (jsPDF built-in fonts are Latin-1 only) ─────────────────

function sanitize(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/[^\x00-\xFF]/g, "?");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Icon loader — renders SVG via canvas for maximum sharpness ──────────────

async function loadIconBase64(): Promise<string | null> {
  try {
    // Try SVG first (vector → rasterise at high res on canvas)
    const svgRes = await fetch("/favicon.svg");
    if (svgRes.ok) {
      const svgText = await svgRes.text();
      const blob = new Blob([svgText], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const size = 512;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    }
    // Fallback: 512px PNG
    const pngRes = await fetch("/icon-512.png");
    const pngBlob = await pngRes.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(pngBlob);
    });
  } catch {
    return null;
  }
}

// ─── Star decorator ──────────────────────────────────────────────────────────

function drawStar(doc: jsPDF, cx: number, cy: number, outerR: number, innerR: number, color: string) {
  const pts = 5;
  const verts: [number, number][] = [];
  for (let i = 0; i < pts * 2; i++) {
    const angle = (i * Math.PI / pts) - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    verts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  const lines: number[][] = verts.slice(1).map((pt, i) => [pt[0] - verts[i][0], pt[1] - verts[i][1]]);
  lines.push([verts[0][0] - verts[verts.length - 1][0], verts[0][1] - verts[verts.length - 1][1]]);
  doc.setFillColor(color);
  doc.lines(lines, verts[0][0], verts[0][1], [1, 1], "F", true);
}

// ─── Mini map renderer ───────────────────────────────────────────────────────

function drawMiniMap(
  doc: jsPDF,
  attempt: QuestionAttempt,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const config = attempt.config;
  const padding = 10;
  const routeStopNames = new Set(attempt.routeStopNames);
  const routeEdgeKeys = new Set<string>();

  for (let i = 1; i < attempt.routeStopNames.length; i += 1) {
    const a = attempt.routeStopNames[i - 1];
    const b = attempt.routeStopNames[i];
    routeEdgeKeys.add(`${a}::${b}`);
    routeEdgeKeys.add(`${b}::${a}`);
  }

  doc.setFillColor("#f1f5f9");
  doc.roundedRect(x, y, width, height, 3, 3, "F");
  doc.setDrawColor("#cbd5e1");
  doc.roundedRect(x, y, width, height, 3, 3, "S");

  const xs = config.stops.map(s => s.x);
  const ys = config.stops.map(s => s.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scaleX = (width - padding * 2) / rangeX;
  const scaleY = (height - padding * 2) / rangeY;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = x + padding + ((width - padding * 2) - rangeX * scale) / 2;
  const offsetY = y + padding + ((height - padding * 2) - rangeY * scale) / 2;

  function mapCoord(sx: number, sy: number) {
    return {
      px: offsetX + (sx - minX) * scale,
      py: offsetY + (sy - minY) * scale,
    };
  }

  doc.setLineWidth(0.8);
  for (const edge of config.edges) {
    const fromStop = config.stops.find(s => s.id === edge.from)!;
    const toStop = config.stops.find(s => s.id === edge.to)!;
    const from = mapCoord(fromStop.x, fromStop.y);
    const to = mapCoord(toStop.x, toStop.y);
    const isRouteEdge = routeEdgeKeys.has(`${fromStop.label}::${toStop.label}`);
    const isHidden = attempt.questionType === "missing-leg" &&
      attempt.hiddenEdgeIndex !== undefined &&
      attempt.config.edges.indexOf(edge) === attempt.hiddenEdgeIndex;

    doc.setDrawColor(isRouteEdge ? "#3b82f6" : "#94a3b8");
    doc.line(from.px, from.py, to.px, to.py);

    const mx = (from.px + to.px) / 2;
    const my = (from.py + to.py) / 2;
    const label = isHidden ? "?" : `${edge.distance} ${config.unit}`;
    doc.setFontSize(isHidden ? 9 : 6);
    doc.setFont("helvetica", isHidden ? "bold" : "normal");
    doc.setTextColor(isHidden ? COLORS.wrongBorder : COLORS.textMuted);
    doc.text(label, mx, my - 3.2, { align: "center" });
  }

  for (const stop of config.stops) {
    const { px, py } = mapCoord(stop.x, stop.y);
    const isOnRoute = routeStopNames.has(stop.label);
    doc.setFillColor(isOnRoute ? "#3b82f6" : "#94a3b8");
    doc.circle(px, py, 1.8, "F");
    doc.setFontSize(5.5);
    doc.setTextColor(isOnRoute ? COLORS.textDark : COLORS.textMuted);
    doc.text(sanitize(stop.label), px, py + 6.2, { align: "center" });
  }
}

// ─── Main PDF generation ─────────────────────────────────────────────────────

export async function generateSessionPdf(summary: SessionSummary): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 15;
  const contentW = pageW - margin * 2;              // 180
  let curY = margin;

  // Load icon (best-effort — may be null if fetch fails)
  const iconBase64 = await loadIconBase64();

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER BANNER — two columns: icon (left) | title + date (right)
  // ═══════════════════════════════════════════════════════════════════════════

  const bannerH = 28;
  doc.setFillColor(COLORS.headerBg);
  doc.roundedRect(margin, curY, contentW, bannerH, 4, 4, "F");
  doc.setDrawColor(COLORS.headerBorder);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, curY, contentW, bannerH, 4, 4, "S");

  const iconSize = 20;          // mm — square icon in left column
  const iconPad = 4;            // padding inside banner
  const iconX = margin + iconPad;
  const iconY = curY + (bannerH - iconSize) / 2;

  if (iconBase64) {
    doc.addImage(iconBase64, "PNG", iconX, iconY, iconSize, iconSize);
  }

  // Right column: title + sub-line
  const titleColX = margin + iconPad + iconSize + 4;
  const titleColW = (margin + contentW) - titleColX - iconPad;
  const titleCX = titleColX + titleColW / 2;   // center of right column

  // Title — dark text on light bg
  doc.setTextColor(COLORS.textDark);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text("Distance Calculator", titleCX, curY + 11, { align: "center" });

  // Sub-line: date (left of col) | level (center) | time (right of col)
  const line2Y = curY + 21;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(sanitize(formatDate(summary.date)), titleColX, line2Y);
  doc.text(
    `${formatTime(summary.startTime)} - ${formatTime(summary.endTime)}`,
    margin + contentW - iconPad, line2Y, { align: "right" }
  );

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(`Session Report (Level ${summary.level})`, titleCX, line2Y, { align: "center" });

  curY += bannerH + 14;   // clear section break before curriculum

  // ═══════════════════════════════════════════════════════════════════════════
  // CURRICULUM — no box, inline text below banner
  // ═══════════════════════════════════════════════════════════════════════════

  const curr = CURRICULUM_LEVELS[summary.level - 1];
  const currInnerW = contentW;
  const currLineH = 4.8;
  const GREEN = "#16a34a";
  const CURR_BLUE = "#1e40af";

  // Measure pill
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  const pillText = curr.code;
  const pillPadX = 3;
  const pillH = 5;
  const pillW = doc.getTextWidth(pillText) + pillPadX * 2;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const stageW = doc.getTextWidth(curr.stageLabel);
  const descAvailW = currInnerW - pillW - 4 - stageW - 4;
  const descWrapped = doc.splitTextToSize(sanitize(curr.description), descAvailW);

  // Title line
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text("NSW Mathematics Curriculum", margin, curY);
  curY += 5.5 + 3.5;   // title height + 1rem gap

  // Row: [pill] [stage] [description] on one baseline
  const pillTopY = curY - pillH + 1.5;
  doc.setFillColor(GREEN);
  doc.roundedRect(margin, pillTopY, pillW, pillH, 1.5, 1.5, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#ffffff");
  doc.text(pillText, margin + pillPadX, curY);
  // Entire row is clickable (pill + stage label + description)
  const rowH = Math.max(pillH, descWrapped.length * currLineH) + 1;
  doc.link(margin, pillTopY, contentW, rowH, { url: curr.syllabusUrl });

  const stageX = margin + pillW + 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(CURR_BLUE);
  doc.text(curr.stageLabel, stageX, curY);
  doc.text(descWrapped, stageX + stageW + 4, curY);
  curY += Math.max(pillH + 1, descWrapped.length * currLineH) + 3.5;  // +1rem gap below

  // Objective line — bold dark
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text("Objective:", margin, curY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    sanitize(curr.levelDesc.replace(/^Level \d+\s*[-–]\s*/i, "")),
    margin + doc.getTextWidth("Objective:") + 2, curY
  );
  curY += currLineH;

  // Basic / Monster round lines
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text("Basic Round:", margin, curY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    "Earn 10 eggs by answering trail distance questions. One new map per question.",
    margin + doc.getTextWidth("Basic Round:") + 2, curY
  );
  curY += currLineH;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text("Monster Round:", margin, curY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    "Defend all 10 eggs against harder questions. Wrong answers lose an egg.",
    margin + doc.getTextWidth("Monster Round:") + 2, curY
  );
  curY += 8;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE BOXES — Score (blue) | Accuracy (red/amber/green) | Time (purple)
  // ═══════════════════════════════════════════════════════════════════════════

  const boxW = (contentW - 8) / 3;
  const boxH = 18;

  // Box 1: Score — blue
  const scoreColor = "#1d4ed8";
  const scoreBg = "#eff6ff";
  doc.setFillColor(scoreBg);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(scoreColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Score", margin + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(scoreColor);
  doc.text(`${summary.correctCount} / ${summary.totalQuestions}`, margin + boxW / 2, curY + 13.5, { align: "center" });

  // Box 2: Accuracy — red / amber / green
  const box2X = margin + boxW + 4;
  const accColor = summary.accuracy >= 80 ? "#16a34a" : summary.accuracy >= 50 ? "#f59e0b" : "#dc2626";
  const accBg   = summary.accuracy >= 80 ? "#f0fdf4" : summary.accuracy >= 50 ? "#fffbeb" : "#fff5f5";
  doc.setFillColor(accBg);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(accColor);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Accuracy", box2X + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accColor);
  doc.text(`${summary.accuracy}%`, box2X + boxW / 2, curY + 13.5, { align: "center" });

  // Box 3: Time — purple
  const box3X = margin + (boxW + 4) * 2;
  doc.setFillColor("#faf5ff");
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(COLORS.accentPurple);
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Total Time", box3X + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.accentPurple);
  doc.text(formatDuration(summary.endTime - summary.startTime), box3X + boxW / 2, curY + 13.5, { align: "center" });

  curY += boxH + 7;

  // ═══════════════════════════════════════════════════════════════════════════
  // EGGS — one per attempt, centered row(s)
  // white = normal correct | gold = monster correct | red = wrong
  // ═══════════════════════════════════════════════════════════════════════════

  const eggRx = 2.2, eggRy = 3, eggStep = 6;
  const maxPerRow = Math.floor(contentW / eggStep);
  const eggRowH = eggRy * 2 + 3;

  for (let rowStart = 0; rowStart < summary.attempts.length; rowStart += maxPerRow) {
    const rowAttempts = summary.attempts.slice(rowStart, rowStart + maxPerRow);
    const rowWidth = rowAttempts.length * eggStep;
    let eggX = margin + (contentW - rowWidth) / 2 + eggStep / 2;
    const eggCY = curY + eggRy;

    for (const attempt of rowAttempts) {
      if (!attempt.isCorrect) {
        doc.setFillColor("#ef4444");
        doc.setDrawColor("#dc2626");
      } else if (attempt.gamePhase === "monster") {
        doc.setFillColor("#facc15");
        doc.setDrawColor("#f59e0b");
      } else {
        doc.setFillColor("#e2e8f0");
        doc.setDrawColor("#94a3b8");
      }
      doc.ellipse(eggX, eggCY, eggRx, eggRy, "FD");
      eggX += eggStep;
    }
    curY += eggRowH;
  }

  curY += 5;

  // Card layout constants
  const cardHeaderH = 10;
  const mapW = 84;
  const mapH = 38;
  const stripeW = 3;
  const cardGap = 5;                 // equal gap on all four sides (top, bottom, left)
  const cardLeft = margin + cardGap; // card starts cardGap from page margin
  const cardRight = margin + contentW;
  const cardContentW = cardRight - cardLeft;
  const mapX = cardLeft + stripeW + 4;   // same gap as bodyPad (top/bottom)
  const textX = mapX + mapW + 5;
  const textW = cardRight - textX - 4;

  for (const attempt of summary.attempts) {
    const promptLinesEstimate = doc.splitTextToSize(sanitize(attempt.prompt), textW);
    let subAnswerHeightEstimate = 0;
    if (attempt.subAnswers && attempt.subAnswers.length > 0) {
      doc.setFontSize(7.5);
      for (const sub of attempt.subAnswers) {
        const subLine = sanitize(
          `${sub.prompt}: answered ${sub.childAnswer} (correct: ${sub.correctAnswer})`,
        );
        const wrapped = doc.splitTextToSize(subLine, textW - 5);
        subAnswerHeightEstimate += wrapped.length * 4.2 + 2.4;
      }
    }
    const estimatedCardH =
      cardHeaderH + Math.max(mapH + 8, promptLinesEstimate.length * 4.5 + 10 + subAnswerHeightEstimate);

    // Equal gap before card
    curY += cardGap;

    if (curY + estimatedCardH > pageH - margin) {
      doc.addPage();
      curY = margin + cardGap;
    }

    const cardBorderColor = attempt.isCorrect ? COLORS.correctBorder : COLORS.wrongBorder;
    const cardBg = attempt.isCorrect ? COLORS.correctBg : COLORS.wrongBg;

    // ── Card header strip ──────────────────────────────────────────────────
    doc.setFillColor(cardBg);
    doc.rect(cardLeft, curY, cardContentW, cardHeaderH, "F");

    // Left color stripe (full card height — includes bodyPad)
    const stripeH = cardHeaderH + 4 + mapH + 4;
    doc.setFillColor(cardBorderColor);
    doc.rect(cardLeft, curY, stripeW, stripeH, "F");

    // Q number (vertically centred in header strip)
    const qLabel = `Q${attempt.questionNumber}`;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.textDark);
    doc.text(qLabel, cardLeft + stripeW + 3, curY + 6.8);

    // MONSTER badge
    if (attempt.gamePhase === "monster") {
      const badgeX = cardLeft + stripeW + 3 + doc.getTextWidth(qLabel) + 2;
      doc.setFillColor("#fef08a");
      doc.roundedRect(badgeX, curY + 2, 16, 5, 1.5, 1.5, "F");
      doc.setFontSize(5.5);
      doc.setTextColor("#92400e");
      doc.text("MONSTER", badgeX + 8, curY + 5.7, { align: "center" });
    }

    // CORRECT / WRONG + time — same line, right-aligned as a group
    const timeStr = formatDuration(attempt.timeTakenMs);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const timeW2 = doc.getTextWidth(timeStr);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const icon = attempt.isCorrect ? "CORRECT" : "WRONG";
    const iconW = doc.getTextWidth(icon);

    const groupRight = pageW - margin - 4;
    const groupStart = groupRight - iconW - 3 - timeW2;

    doc.setTextColor(cardBorderColor);
    doc.text(icon, groupStart, curY + 6.8);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.textMuted);
    doc.text(timeStr, groupRight, curY + 6.8, { align: "right" });

    curY += cardHeaderH;

    // ── Card body: mini map (left 50%) + question text (right 50%) ─────────
    const bodyPad = 4;   // gap between header strip and content
    drawMiniMap(doc, attempt, mapX, curY + bodyPad, mapW, mapH);

    // Question prompt
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.textDark);
    const promptLines = promptLinesEstimate;
    doc.text(promptLines, textX, curY + bodyPad + 5);

    let textY = curY + bodyPad + 5 + promptLines.length * 4.5 + 2;

    if (attempt.subAnswers && attempt.subAnswers.length > 0) {
      // Level 3: sub-step breakdown
      doc.setFontSize(7.5);
      for (const sub of attempt.subAnswers) {
        const subIcon = sub.isCorrect ? "+" : "x";
        doc.setFont("helvetica", "bold");
        doc.setTextColor(sub.isCorrect ? COLORS.correctDark : COLORS.wrongBorder);
        doc.text(subIcon, textX, textY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(COLORS.textDark);
        const promptWrapped = doc.splitTextToSize(
          sanitize(`${sub.prompt}:`),
          textW - 5,
        );
        doc.text(promptWrapped, textX + 4, textY);
        textY += promptWrapped.length * 4.2;

        const answerX = textX + 4;
        const answerPrefix = "answered ";
        const answerValue = sanitize(String(sub.childAnswer));
        const answerSuffix = sanitize(` (correct: ${sub.correctAnswer})`);

        doc.setTextColor(COLORS.textDark);
        doc.text(answerPrefix, answerX, textY);

        const answerValueX = answerX + doc.getTextWidth(answerPrefix);
        doc.setTextColor(sub.isCorrect ? COLORS.correctDark : COLORS.wrongBorder);
        doc.text(answerValue, answerValueX, textY);

        const answerSuffixX = answerValueX + doc.getTextWidth(answerValue);
        doc.setTextColor(COLORS.textDark);
        doc.text(answerSuffix, answerSuffixX, textY);

        textY += 5.2;
      }
    } else {
      // Single answer
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");

      // "Given Answer" — darker green if correct, red if wrong
      doc.setTextColor(attempt.isCorrect ? COLORS.correctDark : COLORS.wrongBorder);
      doc.text(`Given Answer: ${attempt.childAnswer ?? "-"} ${attempt.unit}`, textX, textY);
      textY += 4.5;

      // "Correct answer" — always dark
      doc.setTextColor(COLORS.textDark);
      doc.text(`Correct answer: ${attempt.correctAnswer} ${attempt.unit}`, textX, textY);
      textY += 4.5;
    }

    curY = Math.max(curY + bodyPad + mapH + 4, textY + 4);

    // Separator
    doc.setDrawColor("#e2e8f0");
    doc.setLineWidth(0.3);
    doc.line(cardLeft, curY, cardRight, curY);
    // (next iteration will add cardGap before next card)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENCOURAGEMENT SECTION
  // ═══════════════════════════════════════════════════════════════════════════

  curY += cardGap;

  if (curY + 40 > pageH - margin) {
    doc.addPage();
    curY = margin;
  }

  const encStripH = 32;
  doc.setFillColor("#ede9fe");
  doc.roundedRect(margin, curY, contentW, encStripH, 4, 4, "F");

  // Stars on the left
  const starCY = curY + encStripH / 2 - 2;
  drawStar(doc, margin + 11, starCY - 3, 5, 2.2, "#facc15");
  drawStar(doc, margin + 20, starCY + 4, 3.5, 1.5, "#fbbf24");
  drawStar(doc, margin + 9,  starCY + 6, 2.5, 1.1, "#fde68a");

  // Stars on the right
  const rEdge = margin + contentW;
  drawStar(doc, rEdge - 11, starCY - 3, 5, 2.2, "#facc15");
  drawStar(doc, rEdge - 20, starCY + 4, 3.5, 1.5, "#fbbf24");
  drawStar(doc, rEdge - 9,  starCY + 6, 2.5, 1.1, "#fde68a");

  // Encouragement text centered
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.accentPurple);
  const encouragement =
    summary.accuracy >= 90 ? "Amazing work! You're a distance champion!" :
    summary.accuracy >= 70 ? "Great job! You're getting really good at this!" :
    summary.accuracy >= 50 ? "Nice effort! Keep practising and you'll be a pro!" :
                             "Good try! Every attempt makes you stronger!";
  doc.text(encouragement, pageW / 2, curY + 13, { align: "center" });

  const wrongAttempts = summary.attempts.filter(a => !a.isCorrect);
  if (wrongAttempts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.textMuted);
    const typeLabels: Record<string, string> = {
      "total-distance": "adding distances",
      "missing-leg": "finding missing distances",
      "hub-comparison": "comparing distances",
    };
    const areas = [...new Set(wrongAttempts.map(a => a.questionType))]
      .map(t => typeLabels[t] || t).join(", ");
    doc.text(`Tip: Try practising ${areas} next time!`, pageW / 2, curY + 22, { align: "center" });
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor("#94a3b8");
  doc.text("Generated by Interactive Maths - Distance Calculator", pageW / 2, pageH - 8, { align: "center" });
  doc.text("https://interactive-maths.vercel.app", pageW / 2, pageH - 4, { align: "center" });

  return doc.output("blob");
}
