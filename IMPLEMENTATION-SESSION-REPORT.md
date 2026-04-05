# Implementation Instructions: Session Report PDF & Sharing

## Overview

Add a session report feature to the Distance Calculator game. During gameplay, log every question attempt to an in-memory array. At the end of a round (Level Complete / Monster Round Crushed), offer the child three options: **Download PDF**, **Share** (via Web Share API), or **Discard**. No data persists — once sent/downloaded/discarded, the log is garbage collected.

This document covers everything EXCEPT the email-sending serverless function (that requires domain setup). A placeholder "Email Report" button should be included in the UI but disabled with a "Coming Soon" tooltip.

---

## 1. Install Dependencies

```bash
npm install jspdf
npm install --save-dev @types/jspdf   # (jspdf ships its own types, but just in case)
```

We do NOT need html2canvas. We render the PDF from structured data using jsPDF's drawing API.

---

## 2. Create the Session Logger: `src/report/sessionLog.ts`

This module holds the in-memory log and types. It is NOT React state — it's a plain module-level array so it survives re-renders without causing them.

```typescript
// src/report/sessionLog.ts

import type { TrailConfig, TrailQuestion } from "../game/levelOne";

export interface QuestionAttempt {
  questionNumber: number;
  // Map context
  config: TrailConfig;            // full config for re-rendering the mini map
  // Question details
  prompt: string;                 // e.g. "How far from Newtown to Ashfield?"
  promptLines?: [string, string, string]; // Level 3 sub-prompts
  questionType: "total-distance" | "missing-leg" | "hub-comparison";
  level: 1 | 2 | 3;
  // Route info
  routeStopNames: string[];       // e.g. ["Newtown", "Ashfield", "Marrickville"]
  unit: "km" | "mi";
  // Answers
  correctAnswer: number;
  childAnswer: number | null;     // null if skipped (shouldn't happen but safety)
  subAnswers?: {                  // Level 3 only
    step: number;
    prompt: string;
    correctAnswer: number;
    childAnswer: number;
    isCorrect: boolean;
  }[];
  isCorrect: boolean;
  // Timing
  timestamp: number;              // Date.now() when answered
  timeTakenMs: number;            // ms from question shown to answer submitted
  // Phase
  gamePhase: "normal" | "monster";
  // Dino
  dinoName: string;
}

export interface SessionSummary {
  playerName: string;             // entered at start or "Explorer"
  level: 1 | 2 | 3;
  date: string;                   // ISO date string
  startTime: number;              // Date.now()
  endTime: number;                // Date.now()
  totalQuestions: number;
  correctCount: number;
  accuracy: number;               // 0-100
  normalEggs: number;
  monsterEggs: number;
  levelCompleted: boolean;
  monsterRoundCompleted: boolean;
  attempts: QuestionAttempt[];
}

// ─── Module-level state (NOT React state) ─────────────────────────────────

let _attempts: QuestionAttempt[] = [];
let _questionStartTime: number = Date.now();
let _sessionStartTime: number = Date.now();
let _questionCounter: number = 0;

export function startSession() {
  _attempts = [];
  _questionCounter = 0;
  _sessionStartTime = Date.now();
  startQuestionTimer();
}

export function startQuestionTimer() {
  _questionStartTime = Date.now();
}

export function logAttempt(attempt: Omit<QuestionAttempt, "questionNumber" | "timeTakenMs" | "timestamp">) {
  _questionCounter++;
  _attempts.push({
    ...attempt,
    questionNumber: _questionCounter,
    timestamp: Date.now(),
    timeTakenMs: Date.now() - _questionStartTime,
  });
  // Reset timer for next question
  _questionStartTime = Date.now();
}

export function buildSummary(opts: {
  playerName: string;
  level: 1 | 2 | 3;
  normalEggs: number;
  monsterEggs: number;
  levelCompleted: boolean;
  monsterRoundCompleted: boolean;
}): SessionSummary {
  const correctCount = _attempts.filter(a => a.isCorrect).length;
  return {
    playerName: opts.playerName,
    level: opts.level,
    date: new Date().toISOString(),
    startTime: _sessionStartTime,
    endTime: Date.now(),
    totalQuestions: _attempts.length,
    correctCount,
    accuracy: _attempts.length > 0 ? Math.round((correctCount / _attempts.length) * 100) : 0,
    normalEggs: opts.normalEggs,
    monsterEggs: opts.monsterEggs,
    levelCompleted: opts.levelCompleted,
    monsterRoundCompleted: opts.monsterRoundCompleted,
    attempts: [..._attempts],
  };
}

export function clearSession() {
  _attempts = [];
  _questionCounter = 0;
}

export function getAttemptCount() {
  return _attempts.length;
}
```

---

## 3. Create the PDF Generator: `src/report/generatePdf.ts`

This is the core file. It uses jsPDF to render a multi-page report from the SessionSummary data. The design should be colorful and kid-friendly.

```typescript
// src/report/generatePdf.ts

import { jsPDF } from "jspdf";
import type { SessionSummary, QuestionAttempt } from "./sessionLog";

// ─── Color palette (kid-friendly) ───────────────────────────────────────────

const COLORS = {
  headerBg: "#1e293b",        // dark navy
  headerText: "#ffffff",
  correctBg: "#dcfce7",       // light green
  correctBorder: "#22c55e",   // green
  wrongBg: "#fee2e2",         // light red
  wrongBorder: "#ef4444",     // red
  accentPurple: "#a855f7",
  accentYellow: "#facc15",
  textDark: "#1e293b",
  textMuted: "#64748b",
  pageBg: "#f8fafc",
};

// ─── Helper: format duration ────────────────────────────────────────────────

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

// ─── Mini map renderer ──────────────────────────────────────────────────────
// Draws a simplified trail map into the PDF for each question.
// Uses jsPDF line/circle/text primitives.

function drawMiniMap(
  doc: jsPDF,
  attempt: QuestionAttempt,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const config = attempt.config;
  const padding = 8;

  // Draw background box
  doc.setFillColor("#f1f5f9");
  doc.roundedRect(x, y, width, height, 3, 3, "F");
  doc.setDrawColor("#cbd5e1");
  doc.roundedRect(x, y, width, height, 3, 3, "S");

  // Calculate scale to fit stops into the box
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

  // Draw edges (trail lines) with distance labels
  doc.setDrawColor("#94a3b8");
  doc.setLineWidth(0.8);
  for (const edge of config.edges) {
    const fromStop = config.stops.find(s => s.id === edge.from)!;
    const toStop = config.stops.find(s => s.id === edge.to)!;
    const from = mapCoord(fromStop.x, fromStop.y);
    const to = mapCoord(toStop.x, toStop.y);
    doc.line(from.px, from.py, to.px, to.py);

    // Distance label at midpoint
    const mx = (from.px + to.px) / 2;
    const my = (from.py + to.py) / 2;
    doc.setFontSize(6);
    doc.setTextColor(COLORS.textMuted);
    // For level 2, check if this edge is the hidden one
    const edgeIdx = config.edges.indexOf(edge);
    const isHidden = attempt.questionType === "missing-leg" &&
      attempt.config.edges.indexOf(edge) === (attempt as any).hiddenEdgeIndex;
    const label = isHidden ? "?" : `${edge.distance} ${config.unit}`;
    doc.text(label, mx, my - 1, { align: "center" });
  }

  // Draw stops (nodes) — highlight route stops
  const routeStopNames = new Set(attempt.routeStopNames);
  for (const stop of config.stops) {
    const { px, py } = mapCoord(stop.x, stop.y);
    const isOnRoute = routeStopNames.has(stop.label);
    doc.setFillColor(isOnRoute ? "#3b82f6" : "#94a3b8");
    doc.circle(px, py, isOnRoute ? 2.5 : 1.8, "F");
    doc.setFontSize(5.5);
    doc.setTextColor(isOnRoute ? COLORS.textDark : COLORS.textMuted);
    doc.text(stop.label, px, py + 4.5, { align: "center" });
  }
}

// ─── Main PDF generation ────────────────────────────────────────────────────

export async function generateSessionPdf(summary: SessionSummary): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 15;
  const contentW = pageW - margin * 2;
  let curY = margin;

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  // Header banner
  doc.setFillColor(COLORS.headerBg);
  doc.roundedRect(margin, curY, contentW, 36, 4, 4, "F");

  // Title
  doc.setTextColor("#facc15");
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("Distance Calculator", margin + 8, curY + 13);
  doc.setTextColor("#ffffff");
  doc.setFontSize(14);
  doc.text("Session Report", margin + 8, curY + 22);

  // Date & time in header
  doc.setFontSize(9);
  doc.setTextColor("#94a3b8");
  doc.text(formatDate(summary.date), margin + 8, curY + 31);
  doc.text(
    `${formatTime(summary.startTime)} – ${formatTime(summary.endTime)}`,
    pageW - margin - 8, curY + 31, { align: "right" }
  );

  curY += 44;

  // Player name & level
  doc.setTextColor(COLORS.textDark);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const playerDisplay = summary.playerName || "Explorer";
  doc.text(`${playerDisplay}'s Report`, margin, curY);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(`Level ${summary.level}`, margin + doc.getTextWidth(`${playerDisplay}'s Report  `), curY);
  curY += 10;

  // ── Score card boxes ──────────────────────────────────────────────────────
  const boxW = (contentW - 8) / 3;
  const boxH = 28;

  // Box 1: Score
  doc.setFillColor(COLORS.correctBg);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(COLORS.correctBorder);
  doc.roundedRect(margin, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(9);
  doc.setTextColor(COLORS.textMuted);
  doc.text("Score", margin + boxW / 2, curY + 7, { align: "center" });
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.correctBorder);
  doc.text(`${summary.correctCount} / ${summary.totalQuestions}`, margin + boxW / 2, curY + 20, { align: "center" });

  // Box 2: Accuracy
  const box2X = margin + boxW + 4;
  const accColor = summary.accuracy >= 70 ? COLORS.correctBorder : summary.accuracy >= 40 ? "#f59e0b" : COLORS.wrongBorder;
  doc.setFillColor(summary.accuracy >= 70 ? COLORS.correctBg : summary.accuracy >= 40 ? "#fef3c7" : COLORS.wrongBg);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(accColor);
  doc.roundedRect(box2X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Accuracy", box2X + boxW / 2, curY + 7, { align: "center" });
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(accColor);
  doc.text(`${summary.accuracy}%`, box2X + boxW / 2, curY + 20, { align: "center" });

  // Box 3: Time
  const box3X = margin + (boxW + 4) * 2;
  doc.setFillColor("#ede9fe");
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(COLORS.accentPurple);
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text("Total Time", box3X + boxW / 2, curY + 7, { align: "center" });
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.accentPurple);
  doc.text(formatDuration(summary.endTime - summary.startTime), box3X + boxW / 2, curY + 20, { align: "center" });

  curY += boxH + 8;

  // ── Egg display ───────────────────────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.textDark);
  // Draw egg symbols as circles (white eggs = normal, gold = monster)
  doc.text("Eggs:", margin, curY + 4);
  let eggX = margin + 14;
  for (let i = 0; i < summary.normalEggs; i++) {
    doc.setFillColor("#e2e8f0");
    doc.setDrawColor("#94a3b8");
    doc.ellipse(eggX, curY + 2, 2.2, 3, "FD");
    eggX += 5.5;
  }
  if (summary.monsterEggs > 0) {
    eggX += 3;
    doc.text("+", eggX, curY + 4);
    eggX += 5;
    for (let i = 0; i < summary.monsterEggs; i++) {
      doc.setFillColor("#facc15");
      doc.setDrawColor("#f59e0b");
      doc.ellipse(eggX, curY + 2, 2.2, 3, "FD");
      eggX += 5.5;
    }
  }

  curY += 14;

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTION DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text("Question Details", margin, curY);
  curY += 8;

  for (const attempt of summary.attempts) {
    // Check if we need a new page (each question card is ~55-70mm tall)
    const estimatedHeight = attempt.subAnswers ? 75 : 60;
    if (curY + estimatedHeight > pageH - margin) {
      doc.addPage();
      curY = margin;
    }

    // ── Question card ─────────────────────────────────────────────────────
    const cardBorderColor = attempt.isCorrect ? COLORS.correctBorder : COLORS.wrongBorder;
    const cardBg = attempt.isCorrect ? COLORS.correctBg : COLORS.wrongBg;

    // Card background
    doc.setFillColor(cardBg);
    doc.roundedRect(margin, curY, contentW, 4, 2, 2, "F");

    // Left color stripe
    doc.setFillColor(cardBorderColor);
    doc.rect(margin, curY, 3, 50, "F"); // will be adjusted

    // Question number & phase badge
    const qNumStr = `Q${attempt.questionNumber}`;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.textDark);
    doc.text(qNumStr, margin + 6, curY + 6);

    // Phase badge
    if (attempt.gamePhase === "monster") {
      const badgeX = margin + 6 + doc.getTextWidth(qNumStr) + 3;
      doc.setFillColor("#fef08a");
      doc.roundedRect(badgeX, curY + 1.5, 18, 5.5, 1.5, 1.5, "F");
      doc.setFontSize(6);
      doc.setTextColor("#92400e");
      doc.text("MONSTER", badgeX + 9, curY + 5.2, { align: "center" });
    }

    // Correct/Wrong icon
    doc.setFontSize(10);
    doc.setTextColor(cardBorderColor);
    const icon = attempt.isCorrect ? "CORRECT" : "WRONG";
    doc.text(icon, pageW - margin - 4, curY + 6, { align: "right" });

    // Time taken (small, muted)
    doc.setFontSize(7);
    doc.setTextColor(COLORS.textMuted);
    doc.text(formatDuration(attempt.timeTakenMs), pageW - margin - 4, curY + 11, { align: "right" });

    curY += 14;

    // ── Mini map (left) + Question text (right) ─────────────────────────
    const mapW = 50;
    const mapH = 35;
    const textX = margin + mapW + 6;
    const textW = contentW - mapW - 6;

    drawMiniMap(doc, attempt, margin + 4, curY, mapW, mapH);

    // Question prompt
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.textDark);
    const promptLines = doc.splitTextToSize(attempt.prompt, textW);
    doc.text(promptLines, textX, curY + 4);

    let textY = curY + 4 + promptLines.length * 4.5;

    // Level 3: Show sub-steps
    if (attempt.subAnswers && attempt.subAnswers.length > 0) {
      doc.setFontSize(7.5);
      for (const sub of attempt.subAnswers) {
        const subIcon = sub.isCorrect ? "✓" : "✗";
        const subColor = sub.isCorrect ? COLORS.correctBorder : COLORS.wrongBorder;
        doc.setTextColor(subColor);
        doc.setFont("helvetica", "bold");
        doc.text(subIcon, textX, textY);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(COLORS.textDark);
        const subLine = `${sub.prompt}: answered ${sub.childAnswer} (correct: ${sub.correctAnswer})`;
        doc.text(doc.splitTextToSize(subLine, textW - 5), textX + 4, textY);
        textY += 5;
      }
    } else {
      // Single answer display
      textY += 2;
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");

      // Child's answer
      doc.setTextColor(attempt.isCorrect ? COLORS.correctBorder : COLORS.wrongBorder);
      doc.text(`Your answer: ${attempt.childAnswer ?? "—"} ${attempt.unit}`, textX, textY);
      textY += 4.5;

      // Correct answer (always show)
      doc.setTextColor(COLORS.correctBorder);
      doc.text(`Correct answer: ${attempt.correctAnswer} ${attempt.unit}`, textX, textY);
      textY += 4.5;
    }

    // Update curY to below the card (whichever is taller: map or text)
    curY = Math.max(curY + mapH + 4, textY + 4);

    // Separator line
    doc.setDrawColor("#e2e8f0");
    doc.setLineWidth(0.3);
    doc.line(margin, curY, pageW - margin, curY);
    curY += 5;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL PAGE: ENCOURAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  if (curY + 40 > pageH - margin) {
    doc.addPage();
    curY = margin;
  }

  doc.setFillColor("#ede9fe");
  doc.roundedRect(margin, curY, contentW, 30, 4, 4, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.accentPurple);

  // Pick an encouraging message based on accuracy
  let encouragement: string;
  if (summary.accuracy >= 90) {
    encouragement = "Amazing work! You're a distance champion!";
  } else if (summary.accuracy >= 70) {
    encouragement = "Great job! You're getting really good at this!";
  } else if (summary.accuracy >= 50) {
    encouragement = "Nice effort! Keep practising and you'll be a pro!";
  } else {
    encouragement = "Good try! Every attempt makes you stronger!";
  }
  doc.text(encouragement, pageW / 2, curY + 12, { align: "center" });

  // Areas to work on
  const wrongAttempts = summary.attempts.filter(a => !a.isCorrect);
  if (wrongAttempts.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.textMuted);
    const types = [...new Set(wrongAttempts.map(a => a.questionType))];
    const typeLabels: Record<string, string> = {
      "total-distance": "adding distances",
      "missing-leg": "finding missing distances",
      "hub-comparison": "comparing distances",
    };
    const areas = types.map(t => typeLabels[t] || t).join(", ");
    doc.text(`Tip: Try practising ${areas} next time!`, pageW / 2, curY + 22, { align: "center" });
  }

  curY += 36;

  // Footer
  doc.setFontSize(7);
  doc.setTextColor("#94a3b8");
  doc.text("Generated by Interactive Maths — Distance Calculator", pageW / 2, pageH - 8, { align: "center" });
  doc.text("https://interactive-maths.vercel.app", pageW / 2, pageH - 4, { align: "center" });

  // Return as blob
  return doc.output("blob");
}
```

### Important notes for the PDF generator:

- The `drawMiniMap` function re-renders the trail from the saved `TrailConfig` data. This means each question card shows the actual map the child saw.
- Route stops are highlighted in blue so the parent can see which path the question was about.
- Color coding (green/red borders, backgrounds) matches IXL's convention but with our game's palette.
- The layout puts the mini-map on the left and question details on the right for each card, which is more space-efficient than IXL's full-width approach.
- jsPDF handles pagination automatically via our `curY` tracking and `addPage()` calls.

---

## 4. Create the Share/Download Handler: `src/report/shareReport.ts`

```typescript
// src/report/shareReport.ts

import { generateSessionPdf } from "./generatePdf";
import type { SessionSummary } from "./sessionLog";

export async function downloadReport(summary: SessionSummary): Promise<void> {
  const blob = await generateSessionPdf(summary);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  const name = (summary.playerName || "explorer").toLowerCase().replace(/\s+/g, "-");
  a.download = `distance-report-${name}-${stamp}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareReport(summary: SessionSummary): Promise<boolean> {
  const blob = await generateSessionPdf(summary);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = (summary.playerName || "explorer").toLowerCase().replace(/\s+/g, "-");
  const fileName = `distance-report-${name}-${stamp}.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data?: ShareData) => boolean;
  };

  const shareData: ShareData = {
    files: [file],
    title: `${summary.playerName || "Explorer"}'s Distance Calculator Report`,
    text: `Check out this maths session report! Score: ${summary.correctCount}/${summary.totalQuestions} (${summary.accuracy}%)`,
  };

  // Check if Web Share API with file support is available
  if (typeof nav.share === "function" && typeof nav.canShare === "function") {
    try {
      if (nav.canShare(shareData)) {
        await nav.share(shareData);
        return true;
      }
    } catch (err) {
      // User cancelled or share failed — fall through to download
      if ((err as DOMException).name === "AbortError") {
        return false; // User cancelled, don't fallback
      }
    }
  }

  // Fallback: download
  await downloadReport(summary);
  return true;
}

export function canNativeShare(): boolean {
  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data?: ShareData) => boolean;
  };
  if (typeof nav.share !== "function" || typeof nav.canShare !== "function") {
    return false;
  }
  // Test with a dummy file
  try {
    const dummyFile = new File([new Blob(["test"])], "test.pdf", { type: "application/pdf" });
    return nav.canShare({ files: [dummyFile] });
  } catch {
    return false;
  }
}
```

---

## 5. Create the Report UI Component: `src/components/SessionReportModal.tsx`

This modal appears on the "won" screen (Level Complete / Monster Round Crushed). It overlays the existing win screen.

```tsx
// src/components/SessionReportModal.tsx

import { useState, useCallback } from "react";
import type { SessionSummary } from "../report/sessionLog";
import { downloadReport, shareReport, canNativeShare } from "../report/shareReport";

interface Props {
  summary: SessionSummary;
  onClose: () => void;          // dismiss modal, continue to normal win screen
}

export default function SessionReportModal({ summary, onClose }: Props) {
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);
  const showShareButton = canNativeShare();

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    try {
      await downloadReport(summary);
      setDone(true);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [summary]);

  const handleShare = useCallback(async () => {
    setGenerating(true);
    try {
      await shareReport(summary);
      setDone(true);
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setGenerating(false);
    }
  }, [summary]);

  return (
    <div className="absolute inset-0 z-[90] flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-center shadow-2xl">
        {/* Header */}
        <div className="text-2xl font-black text-yellow-300 mb-1">
          Session Report
        </div>
        <div className="text-sm text-slate-400 mb-4">
          Share your results with a parent or teacher!
        </div>

        {/* Quick stats */}
        <div className="flex justify-center gap-4 mb-5">
          <div className="rounded-lg bg-slate-800 px-4 py-2">
            <div className="text-xs text-slate-500">Score</div>
            <div className="text-lg font-bold text-emerald-400">
              {summary.correctCount}/{summary.totalQuestions}
            </div>
          </div>
          <div className="rounded-lg bg-slate-800 px-4 py-2">
            <div className="text-xs text-slate-500">Accuracy</div>
            <div className="text-lg font-bold text-amber-400">
              {summary.accuracy}%
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2.5">
          {showShareButton && (
            <button
              onClick={handleShare}
              disabled={generating}
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50
                         px-6 py-3 text-base font-bold text-white transition-colors"
            >
              {generating ? "Creating report..." : "Share Report"}
            </button>
          )}

          <button
            onClick={handleDownload}
            disabled={generating}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                       px-6 py-3 text-base font-bold text-white transition-colors"
          >
            {generating ? "Creating report..." : "Download PDF"}
          </button>

          {/* Email — disabled placeholder for now */}
          <button
            disabled
            className="w-full rounded-xl bg-slate-700 px-6 py-3 text-base font-bold
                       text-slate-500 cursor-not-allowed relative group"
            title="Coming soon!"
          >
            Email Report
            <span className="ml-2 text-xs text-slate-600">(coming soon)</span>
          </button>

          {/* Skip / dismiss */}
          <button
            onClick={onClose}
            className="mt-1 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            {done ? "Continue" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Wire It Into ArcadeLevelOneScreen.tsx

This is the integration step — the most critical part. Here are the exact changes needed in `ArcadeLevelOneScreen.tsx`:

### 6a. Add imports at the top of the file

```typescript
import {
  startSession,
  startQuestionTimer,
  logAttempt,
  buildSummary,
  clearSession,
  type QuestionAttempt,
} from "../report/sessionLog";
import SessionReportModal from "../components/SessionReportModal";
import type { SessionSummary } from "../report/sessionLog";
```

### 6b. Add state for report modal

Near the other `useState` declarations (around line 805-850):

```typescript
const [showReportModal, setShowReportModal] = useState(false);
const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
```

### 6c. Call `startSession()` when a new game begins

In the `beginNewRun` function (find it — it resets eggs, creates a new run, etc.), add at the top:

```typescript
startSession();
```

Also call it on initial mount. Find the initial `useEffect` or the place where `createRun(level)` is first called and add `startSession()` there too.

### 6d. Call `startQuestionTimer()` each time a new question is shown

Every time `setCurrentQ(...)` is called (after creating a new run, after earning/losing an egg and moving to the next question), also call:

```typescript
startQuestionTimer();
```

There are multiple places where this happens:
- Inside `earnEgg()` — after `setCurrentQ(next.firstQ)`
- Inside `earnMonsterEgg()` — after `setCurrentQ(next.firstQ)`
- Inside `advanceMonsterQuestionWithoutEgg()` — after `setCurrentQ(next.firstQ)`
- Inside `beginNewRun()` — after the initial question is set
- After `loseEgg()` — the question stays the same but the child retries, so restart timer

### 6e. Log each attempt in `submitAnswer()`

This is the key integration point. In the `submitAnswer()` function, after determining whether the answer is correct, log the attempt.

**For Level 1/2 (single answer, around line 1787-1800):**

After `const correct = Math.abs(guess - currentQ.answer) < 0.11;` and before the `if (correct)` block, add:

```typescript
logAttempt({
  config: config,
  prompt: currentQ.prompt,
  questionType: level === 1 ? "total-distance" : "missing-leg",
  level: level as 1 | 2 | 3,
  routeStopNames: currentQ.route.map(i => config.stops[i].label),
  unit: config.unit,
  correctAnswer: currentQ.answer,
  childAnswer: guess,
  isCorrect: correct,
  gamePhase: gamePhase,
  dinoName: run.dino.nickname,
});
```

**For Level 3 (stepped answers):**

This is trickier because Level 3 has 3 sub-steps. You should only log once per question — when the FINAL step (step 2) is answered. At the final step block (around line 1774-1782, the `// Final step (step 2)` comment), add logging:

```typescript
// Collect sub-answer details for the log
const subAttemptDetails = currentQ.promptLines!.map((prompt, idx) => ({
  step: idx,
  prompt: prompt,
  correctAnswer: currentQ.subAnswers![idx],
  childAnswer: parseFloat(subAnswers[idx]) || 0,
  isCorrect: Math.abs((parseFloat(subAnswers[idx]) || 0) - currentQ.subAnswers![idx]) < 0.11,
}));

logAttempt({
  config: config,
  prompt: currentQ.prompt || currentQ.promptLines![2], // main prompt
  promptLines: currentQ.promptLines,
  questionType: "hub-comparison",
  level: 3,
  routeStopNames: currentQ.route.map(i => config.stops[i].label),
  unit: config.unit,
  correctAnswer: currentQ.subAnswers![2], // final answer
  childAnswer: parseFloat(subAnswers[2]) || 0,
  subAnswers: subAttemptDetails,
  isCorrect: ok,
  gamePhase: gamePhase,
  dinoName: run.dino.nickname,
});
```

Also handle the Level 3 Monster "single line only" mode (the `l3ExtinctionSingleLineOnly` block around line 1732-1746).

### 6f. Show the report modal on level complete

There are TWO completion paths in `earnMonsterEgg()` (around line 1633):

**Path 1 — Levels 1 & 2 complete (line ~1646):** `setScreen("won")`
**Path 2 — All Level 3 complete / grand finale (line ~1640):** `setScreen("gameover")`

In BOTH paths, before setting the screen, build the summary and show the modal. Create a helper function to avoid duplication:

```typescript
function triggerSessionReport() {
  const summary = buildSummary({
    playerName: "", // See section 6h about player name
    level: level as 1 | 2 | 3,
    normalEggs: EGGS_PER_LEVEL,
    monsterEggs: EGGS_PER_LEVEL,
    levelCompleted: true,
    monsterRoundCompleted: true,
  });
  setSessionSummary(summary);
  setShowReportModal(true);
}
```

Then in `earnMonsterEgg()`, the block starting at line ~1635 becomes:

```typescript
if (newGolden === EGGS_PER_LEVEL) {
  setMonsterEggs(EGGS_PER_LEVEL);
  triggerSessionReport();        // <── ADD THIS
  if (level === 3) {
    playGameComplete();
    setScreen("gameover");
  } else {
    playMonsterVictory();
    if (!IS_DEV)
      setUnlockedLevel((u) => Math.max(u, level + 1) as 1 | 2 | 3);
    setScreen("won");
  }
  return;
}
```

### 6g. Render the modal

In the JSX, right after the `{screen === "won" && ( ... )}` block (around line 3460) — and this will also overlay the `{screen === "gameover" && (...)}` block — add:

```tsx
{showReportModal && sessionSummary && (
  <SessionReportModal
    summary={sessionSummary}
    onClose={() => {
      setShowReportModal(false);
      setSessionSummary(null);
      clearSession();
    }}
  />
)}
```

The modal has `z-[90]` which is higher than the won/gameover screens' `z-[80]`, so it will overlay correctly. When the child dismisses the report modal, they see the normal win/gameover screen underneath.

### 6h. Player name (optional enhancement)

The game currently doesn't ask for a player name. Two options:

**Option A (simpler):** Default to "Explorer" and don't ask. The parent/teacher knows whose device it is.

**Option B (better):** Add a small text input on the level select / start screen where the child can optionally type their name. Store it in a `useState` and pass it through to `buildSummary()`. Keep it optional — if blank, use "Explorer".

Recommend Option B but implement Option A first, then add the name input as a follow-up.

---

## 7. File Structure Summary

After implementation, the new files are:

```
src/
├── report/
│   ├── sessionLog.ts          # In-memory session logging
│   ├── generatePdf.ts         # jsPDF-based PDF renderer
│   └── shareReport.ts         # Download / Web Share API handlers
├── components/
│   └── SessionReportModal.tsx  # End-of-round report UI
```

Modified files:

```
src/screens/ArcadeLevelOneScreen.tsx   # Wired up logging + modal
package.json                            # Added jspdf dependency
```

---

## 8. Testing Checklist

- [ ] Play through Level 1 normal phase (10 eggs) + monster round (10 eggs) → verify modal appears
- [ ] Click "Download PDF" → verify PDF downloads with correct filename
- [ ] Open PDF → verify summary page has correct score, accuracy, time
- [ ] Open PDF → verify each question card shows: mini map, prompt, child's answer, correct answer, green/red coding
- [ ] Click "Share" on mobile → verify native share sheet opens with PDF attached
- [ ] Click "Share" on desktop (where Web Share isn't supported) → verify it falls back to download
- [ ] Click "Skip" → verify modal closes and normal win screen is visible
- [ ] Start a new game after report → verify previous session data is cleared
- [ ] Test Level 2 questions in report → verify "?" edge is shown on mini map
- [ ] Test Level 3 questions in report → verify all 3 sub-steps are shown with individual correct/wrong
- [ ] Test with 0% accuracy → verify encouraging message still appears
- [ ] Test with 100% accuracy → verify "champion" message appears
- [ ] Verify PDF file size is reasonable (should be under 500KB for a 20-question session)
- [ ] Test on iOS Safari, Android Chrome, desktop Chrome, Firefox

---

## 9. Future: Email Sending (placeholder)

When the domain is set up, the "Email Report" button will:

1. Show a simple modal with a single email input field
2. Generate the PDF client-side (same `generateSessionPdf()`)
3. Convert the PDF blob to base64
4. POST to a Vercel Edge Function: `POST /api/send-report`
5. The edge function calls Resend's API with the PDF as attachment
6. Child sees "Sent!" confirmation

The edge function scaffold (NOT to implement yet):

```typescript
// api/send-report.ts (Vercel Edge Function — DO NOT IMPLEMENT YET)
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email, pdfBase64, playerName, score } = await req.json();

  // Rate limiting: check IP, max 3/hour
  // Email validation
  // PDF size check (< 2MB)

  await resend.emails.send({
    from: "reports@yourdomain.com",
    to: email,
    subject: `${playerName}'s Distance Calculator Report`,
    html: `<p>${playerName} just finished a maths session! Score: ${score}. See the attached report.</p>`,
    attachments: [{
      filename: "session-report.pdf",
      content: pdfBase64,
    }],
  });

  return Response.json({ ok: true });
}
```

This is documented here for reference but should NOT be built until the domain + Resend account are configured.
