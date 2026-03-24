import type { Level } from "../data/gameData";

interface Props {
  level: Level;
  onStart: () => void;
}

export default function LevelIntroScreen({ level, onStart }: Props) {
  return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-7xl mb-3 animate-bounce-in">{level.emoji}</div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
            Level {level.id}
          </div>
          <div className={`text-3xl font-black ${level.color}`}>{level.title}</div>
        </div>

        {/* Challenge */}
        <div className="bg-white rounded-3xl shadow border border-slate-100 p-6 mb-4">
          <div className="flex items-start gap-3 mb-5">
            <span className="text-2xl">🦖</span>
            <p className="text-slate-700 font-medium leading-relaxed">{level.challenge}</p>
          </div>

          {/* Tip box */}
          <div className={`${level.bg} ${level.border} border rounded-2xl p-4`}>
            <div className={`font-black text-sm uppercase tracking-wide ${level.color} mb-1`}>Rex's Secret Trick</div>
            <p className={`${level.color} text-sm font-medium leading-relaxed`}>{level.tip}</p>
          </div>
        </div>

        <div className="text-center text-slate-400 text-sm mb-4">
          {level.questions.length} questions to complete this level
        </div>

        <button
          onClick={onStart}
          className="w-full bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-lg py-4 rounded-2xl transition-all"
        >
          Let's go! →
        </button>
      </div>
    </div>
  );
}
