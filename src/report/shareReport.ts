// src/report/shareReport.ts

import { generateSessionPdf } from "./generatePdf";
import type { SessionSummary } from "./sessionLog";
import { getT, getLocaleFormat } from "../i18n";

const SITE_URL = "https://www.seemaths.com";
const GAME_NAME = "Distance Calculator";
const SENDER_NAME = "Distance Calculator";
const CURRICULUM_INDEX_URL =
  "https://www.educationstandards.nsw.edu.au/wps/portal/nesa/k-10/learning-areas/mathematics/mathematics-k-10";
const CURRICULUM_BY_LEVEL = {
  1: {
    code: "MA3-7NA",
    descKey: "curriculum.descL1L2" as const,
    syllabusUrl:
      "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
  },
  2: {
    code: "MA3-7NA",
    descKey: "curriculum.descL1L2" as const,
    syllabusUrl:
      "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
  },
  3: {
    code: "MA3-9MG",
    descKey: "curriculum.descL3" as const,
    syllabusUrl:
      "https://www.educationstandards.nsw.edu.au/wps/wcm/connect/ffb1e831-46fc-4db6-975c-7be286334e74/stage-statements-and-outcomes-programming-tool-k-10-landscape.pdf?CVID=&MOD=AJPERES#page=40",
  },
} as const;

function getReportFileName(summary: SessionSummary): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = (summary.playerName || "explorer")
    .toLowerCase()
    .replace(/\s+/g, "-");
  return `distance-report-${name}-${stamp}.pdf`;
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  const lastDigit = day % 10;
  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";
  return "th";
}

function formatSessionDate(timestamp: number, intlLocale = "en-AU"): string {
  // For English (en-AU), keep the existing ordinal format for familiarity
  if (intlLocale.startsWith("en")) {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = date.toLocaleDateString("en-AU", { month: "short" });
    const weekday = date.toLocaleDateString("en-AU", { weekday: "short" });
    return `${weekday} ${day}${getOrdinalSuffix(day)} ${month}`;
  }
  return new Date(timestamp).toLocaleDateString(intlLocale, {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });
}

function formatSessionTime(timestamp: number, intlLocale = "en-AU", timeOptions?: Intl.DateTimeFormatOptions): string {
  const opts: Intl.DateTimeFormatOptions = timeOptions ?? { hour: "numeric", minute: "2-digit", hour12: true };
  return new Date(timestamp).toLocaleTimeString(intlLocale, opts);
}

function formatDurationMinutes(startTime: number, endTime: number): string {
  const minutes = Math.max(1, Math.round((endTime - startTime) / 60000));
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function getEmailMetadata(summary: SessionSummary, locale = "en") {
  const curriculum = CURRICULUM_BY_LEVEL[summary.level];
  const fmt = getLocaleFormat(locale);
  const t = getT(locale);
  const enT = getT("en");
  const sessionTime = formatSessionTime(summary.startTime, fmt.intlLocale, fmt.timeOptions);
  const sessionDate = formatSessionDate(summary.startTime, fmt.intlLocale);
  const durationText = formatDurationMinutes(summary.startTime, summary.endTime);
  const scoreLine = `${summary.correctCount}/${summary.totalQuestions}`;
  const accuracy = `${summary.accuracy}%`;
  const stageLabel = t("curriculum.stageLabel");
  const curriculumDescription = enT(curriculum.descKey);
  return {
    locale,
    playerName: summary.playerName || "Explorer",
    gameName: GAME_NAME,
    senderName: SENDER_NAME,
    siteUrl: SITE_URL,
    sessionTime,
    sessionDate,
    durationText,
    scoreLine,
    accuracy,
    stageLabel,
    curriculumCode: curriculum.code,
    curriculumDescription,
    curriculumUrl: curriculum.syllabusUrl,
    curriculumIndexUrl: CURRICULUM_INDEX_URL,
    // Pre-translated email body strings
    emailSubject: t("email.subject", { gameName: GAME_NAME }),
    emailGreeting: t("email.greeting"),
    emailBodyIntro: t("email.bodyIntro", {
      playerName: summary.playerName || "Explorer",
      game: GAME_NAME,
      time: sessionTime,
      date: sessionDate,
      duration: durationText,
      score: scoreLine,
      accuracy,
    }),
    emailCurriculumIntro: t("email.curriculumIntro", { stageLabel }),
    emailRegards: t("email.regards"),
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildEmailHtml(meta: ReturnType<typeof getEmailMetadata>): string {
  const currText = `${meta.curriculumCode} - ${meta.curriculumDescription}`;
  const stageLink = `<a href="${escapeHtml(meta.curriculumIndexUrl)}"><strong>${escapeHtml(meta.stageLabel)}</strong></a>`;
  const skillLink = `<a href="${escapeHtml(meta.curriculumUrl)}"><strong>${escapeHtml(currText)}</strong></a>`;
  const curriculumIntroHtml = escapeHtml(meta.emailCurriculumIntro).replace(
    escapeHtml(meta.stageLabel),
    stageLink,
  );

  if (meta.locale.startsWith("hi")) {
    return `
      <p>${escapeHtml(meta.emailGreeting)}</p>
      <p>
        <strong>${escapeHtml(meta.playerName)}</strong> ने
        <strong>${escapeHtml(meta.gameName)}</strong>
        <a href="${escapeHtml(meta.siteUrl)}"><strong>SeeMaths</strong></a>
        पर <strong>${escapeHtml(meta.sessionDate)}</strong> को
        <strong>${escapeHtml(meta.sessionTime)}</strong> बजे
        <strong>${escapeHtml(meta.durationText)}</strong> के लिए खेला। स्कोर:
        <strong>${escapeHtml(meta.scoreLine)}</strong>, सटीकता:
        <strong>${escapeHtml(meta.accuracy)}</strong>।
      </p>
      <p>
        ${curriculumIntroHtml}
        ${skillLink}
      </p>
      <p>${escapeHtml(meta.emailRegards)}<br />${escapeHtml(GAME_NAME)}<br /><a href="${escapeHtml(SITE_URL)}">SeeMaths</a></p>
    `;
  }

  if (meta.locale.startsWith("zh")) {
    return `
      <p>${escapeHtml(meta.emailGreeting)}</p>
      <p>
        <strong>${escapeHtml(meta.playerName)}</strong> 于
        <strong>${escapeHtml(meta.sessionDate)}</strong>
        <strong>${escapeHtml(meta.sessionTime)}</strong>
        在 <a href="${escapeHtml(meta.siteUrl)}"><strong>SeeMaths</strong></a>
        玩了 <strong>${escapeHtml(meta.gameName)}</strong>，时长
        <strong>${escapeHtml(meta.durationText)}</strong>。得分：
        <strong>${escapeHtml(meta.scoreLine)}</strong>，正确率：
        <strong>${escapeHtml(meta.accuracy)}</strong>。
      </p>
      <p>
        ${curriculumIntroHtml}
        ${skillLink}
      </p>
      <p>${escapeHtml(meta.emailRegards)}<br />${escapeHtml(GAME_NAME)}<br /><a href="${escapeHtml(SITE_URL)}">SeeMaths</a></p>
    `;
  }

  return `
    <p>${escapeHtml(meta.emailGreeting)}</p>
    <p>
      ${escapeHtml(meta.playerName)} played <strong>${escapeHtml(meta.gameName)}</strong> at
      <a href="${escapeHtml(meta.siteUrl)}"><strong>SeeMaths</strong></a> at
      <strong>${escapeHtml(meta.sessionTime)}</strong> on <strong>${escapeHtml(meta.sessionDate)}</strong>
      for <strong>${escapeHtml(meta.durationText)}</strong>. Score:
      <strong>${escapeHtml(meta.scoreLine)}</strong>, Accuracy: <strong>${escapeHtml(meta.accuracy)}</strong>.
    </p>
    <p>
      ${curriculumIntroHtml}
      ${skillLink}
    </p>
    <p>${escapeHtml(meta.emailRegards)}<br />${escapeHtml(GAME_NAME)}<br /><a href="${escapeHtml(SITE_URL)}">SeeMaths</a></p>
  `;
}

async function buildReportBlob(summary: SessionSummary, locale = "en"): Promise<Blob> {
  const t = getT(locale);
  return generateSessionPdf(summary, t, locale);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to encode report."));
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Invalid report encoding."));
        return;
      }
      const [, base64 = ""] = reader.result.split(",", 2);
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

export async function downloadReport(summary: SessionSummary, locale = "en"): Promise<void> {
  const blob = await buildReportBlob(summary, locale);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = getReportFileName(summary);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareReport(summary: SessionSummary, locale = "en"): Promise<boolean> {
  const blob = await buildReportBlob(summary, locale);
  const fileName = getReportFileName(summary);
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

export async function emailReport(
  summary: SessionSummary,
  email: string,
  locale = "en",
): Promise<void> {
  const blob = await buildReportBlob(summary, locale);
  const response = await fetch("/api/send-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email.trim(),
      pdfBase64: await blobToBase64(blob),
      correctCount: summary.correctCount,
      totalQuestions: summary.totalQuestions,
      ...((meta) => ({ ...meta, emailHtml: buildEmailHtml(meta) }))(getEmailMetadata(summary, locale)),
      reportFileName: getReportFileName(summary),
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || "Failed to send report email.");
  }
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
