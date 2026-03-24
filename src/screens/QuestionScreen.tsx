import { useState } from "react";
import type { Level, Question } from "../data/gameData";
import InteractiveDinoMap from "../components/InteractiveDinoMap";
import { playCorrect, playWrong, isMusicOn, startMusic, stopMusic } from "../sound";

interface Props {
  level: Level;
  question: Question;
  qIndex: number;
  totalQ: number;
  totalLevels: number;
  stars: number;
  onCorrect: () => void;
  onNext: () => void;
}

type State = "answering" | "correct" | "wrong";

export default function QuestionScreen({ level, question, qIndex, totalQ, stars, onCorrect, onNext }: Props) {
  const [state, setState] = useState<State>("answering");
  const [selected, setSelected] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [music, setMusic] = useState(isMusicOn());

  function handleAnswer(opt: string) {
    if (state !== "answering") return;
    setSelected(opt);
    if (opt === question.correct) {
      setState("correct");
      onCorrect();
      playCorrect();
    } else {
      setState("wrong");
      setShake(true);
      playWrong();
      setTimeout(() => setShake(false), 400);
    }
  }

  function handleNext() {
    setState("answering");
    setSelected(null);
    onNext();
  }

  function toggleMusic() {
    if (music) { stopMusic(); setMusic(false); }
    else { startMusic(); setMusic(true); }
  }

  return (
    <div className="min-h-svh flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <div className={`text-lg font-black ${level.color}`}>{level.emoji} {level.title}</div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMusic}
            className="text-lg transition-transform active:scale-90"
            title={music ? "Turn music off" : "Turn music on"}
          >
            {music ? "🔊" : "🔇"}
          </button>
          <span className="text-yellow-400 text-lg">{"\u2b50".repeat(stars)}</span>
          <span className="text-slate-400 text-sm font-medium">{qIndex + 1}/{totalQ}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-blue-400 transition-all duration-500"
          style={{ width: `${(qIndex / totalQ) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-4">
          <div className={shake ? "animate-shake" : ""}>

            {/* Interactive map card */}
            <div className="bg-white rounded-3xl shadow border border-slate-100 p-4 mb-4">
              <InteractiveDinoMap key={question.id} map={question.map} />

              {/* Question text */}
              <p className="text-slate-800 font-semibold text-base leading-relaxed mt-4">
                {question.text}
              </p>
            </div>

            {/* Answer options */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {question.options.map((opt) => {
                const isCorrect = opt === question.correct;
                const isSelected = opt === selected;
                let cls = "bg-white border-2 border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50";
                if (state !== "answering") {
                  if (isCorrect) cls = "bg-emerald-500 border-2 border-emerald-500 text-white scale-105 animate-pop";
                  else if (isSelected) cls = "bg-red-100 border-2 border-red-300 text-red-600";
                  else cls = "bg-white border-2 border-slate-100 text-slate-300 cursor-default";
                }
                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={state !== "answering"}
                    className={`${cls} rounded-2xl py-3 px-4 font-bold text-sm text-center transition-all active:scale-95`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            {/* Correct feedback */}
            {state === "correct" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 animate-bounce-in">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🎉</span>
                  <span className="font-black text-emerald-700 text-lg">Brilliant!</span>
                  <span className="text-yellow-400">⭐</span>
                </div>
                <p className="text-emerald-700 text-sm font-medium">{question.solution}</p>
                <button
                  onClick={handleNext}
                  className="mt-3 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 rounded-xl transition-all active:scale-95"
                >
                  Next →
                </button>
              </div>
            )}

            {/* Wrong feedback */}
            {state === "wrong" && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 animate-bounce-in">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">💡</span>
                  <span className="font-black text-amber-700">Rex's hint:</span>
                </div>
                <p className="text-amber-700 text-sm font-medium mb-3">{question.hint}</p>
                <button
                  onClick={() => { setState("answering"); setSelected(null); }}
                  className="w-full bg-amber-400 hover:bg-amber-500 text-white font-black py-3 rounded-xl transition-all active:scale-95"
                >
                  Try again! 💪
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
