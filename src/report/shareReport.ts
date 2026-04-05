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
