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
