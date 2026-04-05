// src/report/generatePdf.ts

import { jsPDF } from "jspdf";
import type { SessionSummary, QuestionAttempt } from "./sessionLog";

// ─── Color palette ───────────────────────────────────────────────────────────

const COLORS = {
  headerBg: "#1e293b",
  correctBg: "#f0fdf4",
  correctBorder: "#22c55e",
  correctDark: "#16a34a",    // darker green for "Your answer" when correct
  wrongBg: "#fff5f5",
  wrongBorder: "#ef4444",
  accentPurple: "#a855f7",
  textDark: "#1e293b",
  textMuted: "#64748b",
};

// ─── Curriculum metadata (from manifest teachesLevels) ───────────────────────

const CURRICULUM_LEVELS = [
  {
    code: "MA3-7NA",
    description: "Compares, orders and calculates with fractions, decimals and percentages.",
    levelDesc: "Level 1 - Adding decimal distances across multiple road segments to find a total journey distance",
  },
  {
    code: "MA3-7NA",
    description: "Compares, orders and calculates with fractions, decimals and percentages.",
    levelDesc: "Level 2 - Subtraction of decimals with a missing segment shown as \"?\"",
  },
  {
    code: "MA3-9MG",
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
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

  doc.setDrawColor("#94a3b8");
  doc.setLineWidth(0.8);
  for (const edge of config.edges) {
    const fromStop = config.stops.find(s => s.id === edge.from)!;
    const toStop = config.stops.find(s => s.id === edge.to)!;
    const from = mapCoord(fromStop.x, fromStop.y);
    const to = mapCoord(toStop.x, toStop.y);
    doc.line(from.px, from.py, to.px, to.py);

    const mx = (from.px + to.px) / 2;
    const my = (from.py + to.py) / 2;
    doc.setFontSize(6);
    doc.setTextColor(COLORS.textMuted);
    const isHidden = attempt.questionType === "missing-leg" &&
      (attempt.config.edges.indexOf(edge) === (attempt as any).hiddenEdgeIndex);
    const label = isHidden ? "?" : `${edge.distance} ${config.unit}`;
    doc.text(label, mx, my - 1, { align: "center" });
  }

  const routeStopNames = new Set(attempt.routeStopNames);
  for (const stop of config.stops) {
    const { px, py } = mapCoord(stop.x, stop.y);
    const isOnRoute = routeStopNames.has(stop.label);
    doc.setFillColor(isOnRoute ? "#3b82f6" : "#94a3b8");
    doc.circle(px, py, isOnRoute ? 2.5 : 1.8, "F");
    doc.setFontSize(5.5);
    doc.setTextColor(isOnRoute ? COLORS.textDark : COLORS.textMuted);
    doc.text(sanitize(stop.label), px, py + 4.5, { align: "center" });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER BANNER
  // ═══════════════════════════════════════════════════════════════════════════
  // Line 1: "Distance Calculator" centered
  // Line 2: date (left) | "Session Report (Level N)" (center) | time (right)

  const bannerH = 26;
  doc.setFillColor(COLORS.headerBg);
  doc.roundedRect(margin, curY, contentW, bannerH, 4, 4, "F");

  // Line 1: title centered
  doc.setTextColor("#facc15");
  doc.setFontSize(19);
  doc.setFont("helvetica", "bold");
  doc.text("Distance Calculator", pageW / 2, curY + 9, { align: "center" });

  // Line 2: three-column
  const line2Y = curY + 18;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#94a3b8");
  doc.text(sanitize(formatDate(summary.date)), margin + 6, line2Y);
  doc.text(
    `${formatTime(summary.startTime)} - ${formatTime(summary.endTime)}`,
    pageW - margin - 6, line2Y, { align: "right" }
  );

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#ffffff");
  doc.text(`Session Report (Level ${summary.level})`, pageW / 2, line2Y, { align: "center" });

  curY += bannerH + 8;

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE BOXES
  // ═══════════════════════════════════════════════════════════════════════════

  const boxW = (contentW - 8) / 3;
  const boxH = 26;

  // Box 1: Score
  doc.setFillColor(COLORS.correctBg);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(COLORS.correctBorder);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Score", margin + boxW / 2, curY + 7, { align: "center" });
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.correctDark);
  doc.text(`${summary.correctCount} / ${summary.totalQuestions}`, margin + boxW / 2, curY + 19, { align: "center" });

  // Box 2: Accuracy
  const box2X = margin + boxW + 4;
  const accColor = summary.accuracy >= 70 ? COLORS.correctDark : summary.accuracy >= 40 ? "#b45309" : COLORS.wrongBorder;
  const accBg = summary.accuracy >= 70 ? COLORS.correctBg : summary.accuracy >= 40 ? "#fef3c7" : COLORS.wrongBg;
  doc.setFillColor(accBg);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(accColor);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Accuracy", box2X + boxW / 2, curY + 7, { align: "center" });
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accColor);
  doc.text(`${summary.accuracy}%`, box2X + boxW / 2, curY + 19, { align: "center" });

  // Box 3: Time
  const box3X = margin + (boxW + 4) * 2;
  doc.setFillColor("#ede9fe");
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(COLORS.accentPurple);
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Total Time", box3X + boxW / 2, curY + 7, { align: "center" });
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.accentPurple);
  doc.text(formatDuration(summary.endTime - summary.startTime), box3X + boxW / 2, curY + 19, { align: "center" });

  curY += boxH + 7;

  // ═══════════════════════════════════════════════════════════════════════════
  // EGGS — one per attempt, centered row(s), no label
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

  curY += 6;

  // ═══════════════════════════════════════════════════════════════════════════
  // CURRICULUM STRIP
  // ═══════════════════════════════════════════════════════════════════════════

  const curr = CURRICULUM_LEVELS[summary.level - 1];
  const currLineH = 4.5;
  const currPadTop = 7, currPadBot = 6;

  // Pre-calculate how many lines the description + level desc need
  doc.setFontSize(7);
  const currDescLines = doc.splitTextToSize(
    sanitize(`${curr.code} - ${curr.description}`), contentW - 12
  ).length;
  const levelDescLines = doc.splitTextToSize(sanitize(curr.levelDesc), contentW - 12).length;
  const stripH = currPadTop + (currDescLines + levelDescLines + 2) * currLineH + currPadBot;

  doc.setFillColor(COLORS.headerBg);
  doc.roundedRect(margin, curY, contentW, stripH, 3, 3, "F");

  // Strip title
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#facc15");
  doc.text("NSW Mathematics Curriculum", margin + 6, curY + currPadTop);

  let stripY = curY + currPadTop + currLineH + 1;

  // Code + description
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#e2e8f0");
  const codeDescText = doc.splitTextToSize(
    sanitize(`${curr.code} - ${curr.description}`), contentW - 12
  );
  doc.text(codeDescText, margin + 6, stripY);
  stripY += codeDescText.length * currLineH + 1;

  // Level description
  doc.setTextColor("#94a3b8");
  const levelDescText = doc.splitTextToSize(sanitize(curr.levelDesc), contentW - 12);
  doc.text(levelDescText, margin + 6, stripY);
  stripY += levelDescText.length * currLineH + 2;

  // Separator
  doc.setDrawColor("#334155");
  doc.setLineWidth(0.3);
  doc.line(margin + 6, stripY, margin + contentW - 6, stripY);
  stripY += 2;

  // Round descriptions
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#94a3b8");
  doc.text("Basic Round:", margin + 6, stripY);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Earn 10 eggs by answering trail distance questions. One new map per question.",
    margin + 6 + doc.getTextWidth("Basic Round:") + 1.5, stripY
  );
  stripY += currLineH;

  doc.setFont("helvetica", "bold");
  doc.text("Monster Round:", margin + 6, stripY);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Defend all 10 eggs against harder questions. Wrong answers lose an egg.",
    margin + 6 + doc.getTextWidth("Monster Round:") + 1.5, stripY
  );

  curY += stripH + 8;

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text("Question Details", margin, curY);
  curY += 7;

  // Card layout constants
  const cardHeaderH = 10;           // height of the top strip (Q# / CORRECT / time)
  const mapW = 84;                   // ~50% of content
  const mapH = 38;
  const mapX = margin + 4;
  const textX = mapX + mapW + 5;
  const textW = (margin + contentW) - textX - 4;
  const stripeW = 3;

  for (const attempt of summary.attempts) {
    const estimatedCardH = cardHeaderH + mapH + 8 + (attempt.subAnswers ? 30 : 0);
    if (curY + estimatedCardH > pageH - margin) {
      doc.addPage();
      curY = margin;
    }

    const cardBorderColor = attempt.isCorrect ? COLORS.correctBorder : COLORS.wrongBorder;
    const cardBg = attempt.isCorrect ? COLORS.correctBg : COLORS.wrongBg;

    // ── Card header strip ──────────────────────────────────────────────────
    doc.setFillColor(cardBg);
    doc.rect(margin, curY, contentW, cardHeaderH, "F");

    // Left color stripe (full card height — estimated)
    const stripeH = cardHeaderH + mapH + 4;
    doc.setFillColor(cardBorderColor);
    doc.rect(margin, curY, stripeW, stripeH, "F");

    // Q number (vertically centred in header strip)
    const qLabel = `Q${attempt.questionNumber}`;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.textDark);
    doc.text(qLabel, margin + stripeW + 3, curY + 6.8);

    // MONSTER badge
    if (attempt.gamePhase === "monster") {
      const badgeX = margin + stripeW + 3 + doc.getTextWidth(qLabel) + 2;
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
    drawMiniMap(doc, attempt, mapX, curY, mapW, mapH);

    // Question prompt
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.textDark);
    const promptLines = doc.splitTextToSize(sanitize(attempt.prompt), textW);
    doc.text(promptLines, textX, curY + 5);

    let textY = curY + 5 + promptLines.length * 4.5 + 2;

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
        const subLine = sanitize(`${sub.prompt}: answered ${sub.childAnswer} (correct: ${sub.correctAnswer})`);
        doc.text(doc.splitTextToSize(subLine, textW - 5), textX + 4, textY);
        textY += 5;
      }
    } else {
      // Single answer
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");

      // "Your answer" — darker green if correct, red if wrong
      doc.setTextColor(attempt.isCorrect ? COLORS.correctDark : COLORS.wrongBorder);
      doc.text(`Your answer: ${attempt.childAnswer ?? "-"} ${attempt.unit}`, textX, textY);
      textY += 4.5;

      // "Correct answer" — always dark
      doc.setTextColor(COLORS.textDark);
      doc.text(`Correct answer: ${attempt.correctAnswer} ${attempt.unit}`, textX, textY);
      textY += 4.5;
    }

    curY = Math.max(curY + mapH + 4, textY + 4);

    // Separator
    doc.setDrawColor("#e2e8f0");
    doc.setLineWidth(0.3);
    doc.line(margin, curY, pageW - margin, curY);
    curY += 5;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENCOURAGEMENT SECTION
  // ═══════════════════════════════════════════════════════════════════════════

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
