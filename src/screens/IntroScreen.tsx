import type { AnalysisData } from "../types";

interface Props {
  data: AnalysisData;
  onStart: () => void;
}

export default function IntroScreen({ data, onStart }: Props) {
  const childName = data.summary.split(" ")[0];

  return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-emerald-100 via-sky-50 to-purple-100 p-4">
      <div className="max-w-md w-full">
        {/* Dino hero */}
        <div className="text-center mb-6">
          <div className="text-8xl animate-float mb-2">🦕</div>
          <div className="text-4xl font-black text-slate-800 tracking-tight">
            Dino Island Adventure
          </div>
          <div className="text-slate-500 mt-1 text-sm font-medium uppercase tracking-widest">
            A maths quest for {childName}
          </div>
        </div>

        {/* Mission card */}
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 mb-5">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl">📜</span>
            <div>
              <div className="font-bold text-slate-800 text-lg">Your Mission</div>
              <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                Help Rex the dinosaur navigate between prehistoric islands by calculating map distances. Master 4 challenges to earn your place in the Dino Hall of Fame!
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {[
              { emoji: "🦕", label: "Trace the Trail" },
              { emoji: "🗺️", label: "Missing Map Piece" },
              { emoji: "⚡", label: "Route Race" },
              { emoji: "🏆", label: "Shortest Shortcut" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                <span className="text-xl">{item.emoji}</span>
                <span className="text-xs font-semibold text-slate-600">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onStart}
          className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-xl py-4 rounded-2xl shadow-lg transition-all"
        >
          Start Adventure! 🚀
        </button>
      </div>
    </div>
  );
}
