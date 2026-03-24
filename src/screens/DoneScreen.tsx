import type { AnalysisData } from "../types";

interface Props {
  data: AnalysisData;
  totalStars: number;
  maxStars: number;
}

export default function DoneScreen({ data, totalStars, maxStars }: Props) {
  const childName = data.summary.split(" ")[0];
  const pct = Math.round((totalStars / maxStars) * 100);
  const medal = pct === 100 ? "🥇" : pct >= 75 ? "🥈" : "🥉";

  return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-purple-100 via-sky-50 to-emerald-100 p-4">
      <div className="max-w-md w-full">
        {/* Hero */}
        <div className="text-center mb-6">
          <div className="text-8xl animate-float mb-2">{medal}</div>
          <div className="text-3xl font-black text-slate-800">
            {pct === 100 ? "Legendary!" : pct >= 75 ? "Awesome!" : "Great effort!"}
          </div>
          <div className="text-slate-500 mt-1">
            {childName} has completed the Dino Island Adventure
          </div>
        </div>

        {/* Score card */}
        <div className="bg-white rounded-3xl shadow border border-slate-100 p-6 mb-5">
          <div className="text-center mb-4">
            <div className="text-2xl mb-1">
              {Array.from({ length: totalStars }).map((_, i) => (
                <span key={i} className="animate-star inline-block" style={{ animationDelay: `${i * 0.05}s` }}>⭐</span>
              ))}
            </div>
            <div className="text-slate-500 text-sm font-medium">{totalStars} / {maxStars} stars</div>
          </div>

          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-right text-xs text-slate-400 mt-1">{pct}%</div>

          <div className="mt-4 space-y-2">
            {[
              { emoji: "🦕", label: "Trace the Trail", desc: "Follow the whole path before adding" },
              { emoji: "🗺️", label: "Missing Map Piece", desc: "Subtract known pieces from the total" },
              { emoji: "⚡", label: "Route Race", desc: "Find BOTH totals before comparing" },
              { emoji: "🏆", label: "Shortest Shortcut", desc: "Calculate ALL routes, then choose smallest" },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-2 text-sm">
                <span>{item.emoji}</span>
                <div>
                  <span className="font-bold text-slate-700">{item.label}: </span>
                  <span className="text-slate-500">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => window.open("https://www.ixl.com", "_blank")}
          className="w-full bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-black text-xl py-4 rounded-2xl shadow transition-all"
        >
          Now try IXL! 🚀
        </button>

        <button
          onClick={() => window.location.reload()}
          className="w-full mt-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-2xl transition-all"
        >
          Play again 🔄
        </button>
      </div>
    </div>
  );
}
