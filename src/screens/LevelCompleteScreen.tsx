import type { Level } from "../data/gameData";

interface Props {
  level: Level;
  stars: number;
  onNext: () => void;
  isLastLevel: boolean;
}

export default function LevelCompleteScreen({ level, stars, onNext, isLastLevel }: Props) {
  return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
      <div className="max-w-sm w-full text-center">
        <div className="text-7xl mb-3 animate-bounce-in">
          {isLastLevel ? "🏆" : "🎊"}
        </div>
        <div className="text-3xl font-black text-slate-800 mb-1">
          {isLastLevel ? "All Levels Done!" : "Level Complete!"}
        </div>
        <div className={`text-lg font-bold ${level.color} mb-6`}>
          {level.emoji} {level.title}
        </div>

        {/* Stars */}
        <div className="bg-white rounded-3xl shadow border border-slate-100 p-6 mb-6">
          <div className="text-4xl mb-2">
            {Array.from({ length: stars }).map((_, i) => (
              <span key={i} className="animate-star inline-block" style={{ animationDelay: `${i * 0.1}s` }}>⭐</span>
            ))}
          </div>
          <div className="text-slate-600 font-medium text-sm">
            {stars === level.questions.length
              ? "Perfect score! Rex is impressed! 🦕"
              : `${stars} star${stars !== 1 ? "s" : ""} — great effort!`}
          </div>
        </div>

        <button
          onClick={onNext}
          className="w-full bg-amber-400 hover:bg-amber-500 active:scale-95 text-white font-black text-xl py-4 rounded-2xl shadow transition-all"
        >
          {isLastLevel ? "See final score! 🏆" : "Next Level →"}
        </button>
      </div>
    </div>
  );
}
