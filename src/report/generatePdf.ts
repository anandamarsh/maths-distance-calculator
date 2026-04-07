// src/report/generatePdf.ts

import { jsPDF } from "jspdf";
import type { SessionSummary, QuestionAttempt } from "./sessionLog";
import type { TFunction } from "../i18n/types";

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

// ─── Curriculum metadata ─────────────────────────────────────────────────────

const CURRICULUM_LEVELS = [
  {
    code: "MA3-7NA",
    descKey: "curriculum.descL1L2" as const,
    syllabusUrl: "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
  },
  {
    code: "MA3-7NA",
    descKey: "curriculum.descL1L2" as const,
    syllabusUrl: "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
  },
  {
    code: "MA3-9MG",
    descKey: "curriculum.descL3" as const,
    syllabusUrl: "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
  },
];

// ─── Text sanitiser (jsPDF built-in fonts are Latin-1 only) ─────────────────

function sanitize(text: string, useUnicode = false): string {
  if (useUnicode) {
    return text.replace(/→/g, "→").replace(/–/g, "-").replace(/—/g, "-");
  }
  return text
    .replace(/→/g, "->")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/[^\x00-\xFF]/g, "?");
}

// ─── Script-aware text wrapper ───────────────────────────────────────────────
// jsPDF's splitTextToSize uses glyph-width tables that don't cover Devanagari
// or CJK. For these scripts we use character-count based word wrapping.

function splitTextForPdf(text: string, doc: jsPDF, maxWidth: number): string[] {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const hasCJK = /[\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(text);

  if (!hasDevanagari && !hasCJK) {
    return doc.splitTextToSize(text, maxWidth);
  }

  // jsPDF cannot reliably measure glyph widths for complex/CJK scripts loaded
  // as custom TTF fonts. Use character-count wrapping instead.
  // Devanagari: ~50 Unicode codepoints per 89mm at 8.5pt (avg ~1.8mm/glyph).
  // CJK: full-width glyphs ~3mm each at 8.5pt → ~30 chars per 89mm.
  const baseChars = hasDevanagari ? 50 : 30;
  const maxCharsPerLine = Math.round(baseChars * (maxWidth / 89));

  const sentences = text.split(/(?<=[।?？。！!])\s*/).filter(s => s.trim().length > 0);
  const result: string[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length <= maxCharsPerLine || !line) {
        line = candidate;
      } else {
        result.push(line);
        line = word;
      }
    }
    if (line) result.push(line);
  }
  return result.filter(s => s.trim().length > 0);
}

// ─── Font URL → locale mapping for non-Latin scripts ─────────────────────────

const UNICODE_FONT_MAP: Partial<Record<string, string>> = {
  hi: "/fonts/NotoSansDevanagari-Regular.ttf",
  en: "/fonts/NotoSans-Regular.ttf",
  zh: "/fonts/NotoSansSC-Regular.ttf",
};

async function loadFontBase64(locale: string): Promise<{ name: string; base64: string } | null> {
  const url = UNICODE_FONT_MAP[locale] ?? "/fonts/NotoSans-Regular.ttf";
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const name = locale === "hi" ? "NotoSansDevanagari" : locale === "zh" ? "NotoSansSC" : "NotoSans";
    return { name, base64: btoa(binary) };
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number, minLabel = "m", secLabel = "s"): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}${secLabel}`;
  return `${min}${minLabel} ${sec}${secLabel}`;
}


function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
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
  fontName = "helvetica",
  useUnicode = false,
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
    doc.setFont(fontName, "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(isOnRoute ? COLORS.textDark : COLORS.textMuted);
    doc.text(sanitize(stop.label, useUnicode), px, py + 6.2, { align: "center" });
  }
}

// ─── Main PDF generation ─────────────────────────────────────────────────────

export async function generateSessionPdf(summary: SessionSummary, t: TFunction, locale = "en"): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 15;
  const contentW = pageW - margin * 2;              // 180
  let curY = margin;

  // Load Unicode font for the locale
  const fontData = await loadFontBase64(locale);
  const fontName = fontData?.name ?? "helvetica";
  const useUnicode = fontData !== null;
  if (fontData) {
    const fileName = `${fontData.name}-Regular.ttf`;
    doc.addFileToVFS(fileName, fontData.base64);
    doc.addFont(fileName, fontData.name, "normal");
    doc.addFont(fileName, fontData.name, "bold");
    doc.setFont(fontData.name, "normal");
  }

  // Load icon (best-effort — may be null if fetch fails)
  const iconBase64 = await loadIconBase64();

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER BANNER — two columns: icon (left) | title + date (right)
  // ═══════════════════════════════════════════════════════════════════════════

  const bannerH = 33;
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

  // Title — always use helvetica (title is ASCII "Distance Calculator")
  doc.setTextColor(COLORS.textDark);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text(t("pdf.title"), titleCX, curY + 11, { align: "center" });

  // Sub-line: date (left of col) | level (center) | duration (right of col)
  const line2Y = curY + 21;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(formatDate(summary.date), titleColX, line2Y);
  doc.text(
    formatDuration(summary.endTime - summary.startTime),
    margin + contentW - iconPad, line2Y, { align: "right" }
  );

  doc.setFontSize(9);
  doc.setFont(fontName, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(sanitize(t("pdf.sessionReport", { n: summary.level }), useUnicode), titleCX, line2Y, { align: "center" });

  // Player name line
  if (summary.playerName) {
    doc.setFontSize(8);
    doc.setFont(fontName, "normal");
    doc.setTextColor(COLORS.textMuted);
    doc.text(sanitize(summary.playerName, useUnicode), titleCX, line2Y + 7, { align: "center" });
  }

  curY += bannerH + 14;   // clear section break before curriculum

  // ═══════════════════════════════════════════════════════════════════════════
  // CURRICULUM — no box, inline text below banner
  // ═══════════════════════════════════════════════════════════════════════════

  const curr = CURRICULUM_LEVELS[summary.level - 1];
  const currLineH = 4.8;
  const GREEN = "#16a34a";
  const CURR_BLUE = "#1e40af";
  const stageLabel = t("curriculum.stageLabel");
  const currDescription = sanitize(t(curr.descKey), useUnicode);

  // Measure pill using helvetica (reliable width measurement for ASCII code)
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  const pillText = curr.code;
  const pillPadX = 3;
  const pillH = 5;
  const pillW = doc.getTextWidth(pillText) + pillPadX * 2;

  // Title line
  doc.setFontSize(9);
  doc.setFont(fontName, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(sanitize(t("pdf.nswCurriculum"), useUnicode), margin, curY);
  curY += 5.5 + 2;   // title height + gap

  // Row: [pill] [stage label + description, wrapped]
  const pillTopY = curY - pillH + 1.5;
  doc.setFillColor(GREEN);
  doc.roundedRect(margin, pillTopY, pillW, pillH, 1.5, 1.5, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor("#ffffff");
  doc.text(pillText, margin + pillPadX, curY);

  const stageX = margin + pillW + 4;
  const stageDescW = contentW - pillW - 4;
  // Combine stage label and description into one wrapped block
  const stageAndDesc = sanitize(stageLabel, useUnicode) + " " + currDescription;
  const stageDescWrapped = splitTextForPdf(stageAndDesc, doc, stageDescW);

  doc.setFontSize(7.5);
  doc.setFont(fontName, "normal");
  doc.setTextColor(CURR_BLUE);
  doc.text(stageDescWrapped[0] ?? "", stageX, curY);
  if (stageDescWrapped.length > 1) {
    doc.setTextColor(COLORS.textMuted);
    doc.text(stageDescWrapped.slice(1), stageX, curY + currLineH);
  }

  // Entire row is clickable
  doc.link(margin, pillTopY, contentW, pillH + 1, { url: curr.syllabusUrl });
  curY += stageDescWrapped.length * currLineH + 3;  // gap below

  // Objective line — bold dark
  const objectiveText =
    summary.level === 1 ? t("pdf.objectiveLevel1") :
    summary.level === 2 ? t("pdf.objectiveLevel2") :
                          t("pdf.objectiveLevel3");
  doc.setFontSize(8);
  doc.setFont(fontName, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(sanitize(t("pdf.objectiveLabel"), useUnicode), margin, curY);
  doc.setFont(fontName, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    sanitize(objectiveText, useUnicode),
    margin + doc.getTextWidth(sanitize(t("pdf.objectiveLabel"), useUnicode)) + 2, curY
  );
  curY += currLineH;

  // Basic / Monster round lines
  const basicRoundLabel = sanitize(t("pdf.basicRound"), useUnicode);
  const monsterRoundLabel = sanitize(t("pdf.monsterRoundLabel"), useUnicode);
  doc.setFont(fontName, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(basicRoundLabel, margin, curY);
  doc.setFont(fontName, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    sanitize(t("pdf.basicRoundDesc"), useUnicode),
    margin + doc.getTextWidth(basicRoundLabel) + 2, curY
  );
  curY += currLineH;

  doc.setFont(fontName, "bold");
  doc.setTextColor(COLORS.textDark);
  doc.text(monsterRoundLabel, margin, curY);
  doc.setFont(fontName, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(
    sanitize(t("pdf.monsterRoundDesc"), useUnicode),
    margin + doc.getTextWidth(monsterRoundLabel) + 2, curY
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
  doc.setFont(fontName, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(sanitize(t("pdf.scoreLabel"), useUnicode), margin + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont(fontName, "bold");
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
  doc.setFont(fontName, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(sanitize(t("pdf.accuracyLabel"), useUnicode), box2X + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont(fontName, "bold");
  doc.setTextColor(accColor);
  doc.text(`${summary.accuracy}%`, box2X + boxW / 2, curY + 13.5, { align: "center" });

  // Box 3: Time — purple
  const box3X = margin + (boxW + 4) * 2;
  doc.setFillColor("#faf5ff");
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "F");
  doc.setDrawColor(COLORS.accentPurple);
  doc.roundedRect(box3X, curY, boxW, boxH, 3, 3, "S");
  doc.setFontSize(7.5);
  doc.setFont(fontName, "normal");
  doc.setTextColor(COLORS.textMuted);
  doc.text(sanitize(t("pdf.timeLabel"), useUnicode), box3X + boxW / 2, curY + 5.5, { align: "center" });
  doc.setFontSize(15);
  doc.setFont(fontName, "bold");
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
  const mapW = 72;
  const mapH = 38;
  const stripeW = 3;
  const cardGap = 5;                 // equal gap on all four sides (top, bottom, left)
  const cardLeft = margin + cardGap; // card starts cardGap from page margin
  const cardRight = margin + contentW;
  const cardContentW = cardRight - cardLeft;
  const mapX = cardLeft + stripeW + 4;   // same gap as bodyPad (top/bottom)
  const textX = mapX + mapW + 4;
  const textW = cardRight - textX - 3;

  for (const attempt of summary.attempts) {
    const promptLinesEstimate = splitTextForPdf(sanitize(attempt.prompt, useUnicode), doc, textW);
    let subAnswerHeightEstimate = 0;
    if (attempt.subAnswers && attempt.subAnswers.length > 0) {
      for (const sub of attempt.subAnswers) {
        const promptLines = splitTextForPdf(sanitize(sub.prompt, useUnicode), doc, textW - 8);
        subAnswerHeightEstimate += promptLines.length * 4.2 + 0.5 + 5.0; // prompt + answer line
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
    const qLabel = sanitize(t("pdf.questionLabel", { n: attempt.questionNumber }), useUnicode);
    doc.setFontSize(10);
    doc.setFont(fontName, "bold");
    doc.setTextColor(COLORS.textDark);
    doc.text(qLabel, cardLeft + stripeW + 3, curY + 6.8);

    // MONSTER badge
    if (attempt.gamePhase === "monster") {
      const badgeX = cardLeft + stripeW + 3 + doc.getTextWidth(qLabel) + 2;
      doc.setFillColor("#fef08a");
      doc.roundedRect(badgeX, curY + 2, 16, 5, 1.5, 1.5, "F");
      doc.setFontSize(5.5);
      doc.setTextColor("#92400e");
      doc.text(sanitize(t("pdf.monsterBadge"), useUnicode), badgeX + 8, curY + 5.7, { align: "center" });
    }

    // CORRECT / WRONG + time — same line, right-aligned as a group
    const timeStr = formatDuration(attempt.timeTakenMs);
    doc.setFontSize(7);
    doc.setFont(fontName, "normal");
    const timeW2 = doc.getTextWidth(timeStr);

    doc.setFontSize(9);
    doc.setFont(fontName, "bold");
    const icon = sanitize(attempt.isCorrect ? t("pdf.correct") : t("pdf.wrong"), useUnicode);
    const iconW = doc.getTextWidth(icon);

    const groupRight = pageW - margin - 4;
    const groupStart = groupRight - iconW - 3 - timeW2;

    doc.setTextColor(cardBorderColor);
    doc.text(icon, groupStart, curY + 6.8);

    doc.setFontSize(7);
    doc.setFont(fontName, "normal");
    doc.setTextColor(COLORS.textMuted);
    doc.text(timeStr, groupRight, curY + 6.8, { align: "right" });

    curY += cardHeaderH;

    // ── Card body: mini map (left 50%) + question text (right 50%) ─────────
    const bodyPad = 4;   // gap between header strip and content
    drawMiniMap(doc, attempt, mapX, curY + bodyPad, mapW, mapH, fontName, useUnicode);

    // Question prompt
    doc.setFontSize(8.5);
    doc.setFont(fontName, "bold");
    doc.setTextColor(COLORS.textDark);
    const promptLines = promptLinesEstimate;
    doc.text(promptLines, textX, curY + bodyPad + 5);

    let textY = curY + bodyPad + 5 + promptLines.length * 4.5 + 2;

    if (attempt.subAnswers && attempt.subAnswers.length > 0) {
      // Level 3: sub-step breakdown
      doc.setFontSize(7.5);
      for (const sub of attempt.subAnswers) {
        const subIcon = sub.isCorrect ? "+" : "x";
        // Render sub-prompt text (without ":") — split to fit column
        const sanitizedSubPrompt = sanitize(sub.prompt, useUnicode);
        const promptWrapped = splitTextForPdf(sanitizedSubPrompt, doc, textW - 8);
        // Append ":" to last line
        if (promptWrapped.length > 0) promptWrapped[promptWrapped.length - 1] += ":";

        doc.setFont(fontName, "bold");
        doc.setTextColor(sub.isCorrect ? COLORS.correctDark : COLORS.wrongBorder);
        doc.text(subIcon, textX, textY);
        doc.setFont(fontName, "normal");
        doc.setTextColor(COLORS.textDark);
        doc.text(promptWrapped, textX + 4, textY);
        textY += promptWrapped.length * 4.2 + 0.5;

        // Answer line — all on one line: prefix + colored value + suffix
        const answerPrefix = sanitize(t("pdf.answered", { value: "" }), useUnicode);
        const answerValue = sanitize(String(sub.childAnswer));
        const answerSuffix = sanitize(t("pdf.correctIn", { value: sub.correctAnswer }), useUnicode);

        doc.setFontSize(7);
        doc.setTextColor(COLORS.textDark);
        const ansX = textX + 4;
        doc.text(answerPrefix, ansX, textY);
        const ansValueX = ansX + doc.getTextWidth(answerPrefix);
        doc.setTextColor(sub.isCorrect ? COLORS.correctDark : COLORS.wrongBorder);
        doc.text(answerValue, ansValueX, textY);
        doc.setTextColor(COLORS.textDark);
        doc.text(answerSuffix, ansValueX + doc.getTextWidth(answerValue), textY);
        doc.setFontSize(7.5);

        textY += 5.0;
      }
    } else {
      // Single answer
      doc.setFontSize(8);
      doc.setFont(fontName, "normal");

      // "Given Answer" — darker green if correct, red if wrong
      doc.setTextColor(attempt.isCorrect ? COLORS.correctDark : COLORS.wrongBorder);
      doc.text(sanitize(t("pdf.givenAnswer", { value: `${attempt.childAnswer ?? "-"} ${attempt.unit}` }), useUnicode), textX, textY);
      textY += 4.5;

      // "Correct answer" — always dark
      doc.setTextColor(COLORS.textDark);
      doc.text(sanitize(t("pdf.correctAnswer", { value: `${attempt.correctAnswer} ${attempt.unit}` }), useUnicode), textX, textY);
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
  doc.setFont(fontName, "bold");
  doc.setTextColor(COLORS.accentPurple);
  const encouragement =
    summary.accuracy >= 90 ? t("pdf.encourage90") :
    summary.accuracy >= 70 ? t("pdf.encourage70") :
    summary.accuracy >= 50 ? t("pdf.encourage50") :
                             t("pdf.encourageBelow");
  doc.text(sanitize(encouragement, useUnicode), pageW / 2, curY + 13, { align: "center" });

  const wrongAttempts = summary.attempts.filter(a => !a.isCorrect);
  if (wrongAttempts.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont(fontName, "normal");
    doc.setTextColor(COLORS.textMuted);
    const typeLabels: Record<string, string> = {
      "total-distance": t("pdf.areaAddingDistances"),
      "missing-leg": t("pdf.areaFindingMissing"),
      "hub-comparison": t("pdf.areaComparingDistances"),
    };
    const areas = [...new Set(wrongAttempts.map(a => a.questionType))]
      .map(qt => typeLabels[qt] || qt).join(", ");
    doc.text(sanitize(t("pdf.tipAreas", { areas }), useUnicode), pageW / 2, curY + 22, { align: "center" });
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor("#94a3b8");
  doc.text(sanitize(t("pdf.footer"), useUnicode), pageW / 2, pageH - 8, { align: "center" });
  doc.text(sanitize(t("pdf.footerUrl"), useUnicode), pageW / 2, pageH - 4, { align: "center" });

  return doc.output("blob");
}
