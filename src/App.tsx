import { useEffect, useState } from "react";
import type { AnalysisData } from "./types";
import { LEVELS } from "./data/gameData";
import IntroScreen from "./screens/IntroScreen";
import LevelIntroScreen from "./screens/LevelIntroScreen";
import QuestionScreen from "./screens/QuestionScreen";
import LevelCompleteScreen from "./screens/LevelCompleteScreen";
import DoneScreen from "./screens/DoneScreen";

type Screen = "loading" | "intro" | "level-intro" | "question" | "level-complete" | "done";

const MAX_STARS = LEVELS.reduce((s, l) => s + l.questions.length, 0);

export default function App() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [levelIdx, setLevelIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [levelStars, setLevelStars] = useState(0);
  const [totalStars, setTotalStars] = useState(0);

  useEffect(() => {
    fetch("/data.json").then((r) => r.json()).then((d) => {
      setData(d);
      setScreen("intro");
    });
  }, []);

  if (screen === "loading" || !data) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-slate-50">
        <div className="text-6xl animate-float">🦕</div>
      </div>
    );
  }

  const level = LEVELS[levelIdx];
  const question = level?.questions[qIdx];

  if (screen === "intro") {
    return <IntroScreen data={data} onStart={() => setScreen("level-intro")} />;
  }

  if (screen === "level-intro") {
    return <LevelIntroScreen level={level} onStart={() => { setQIdx(0); setLevelStars(0); setScreen("question"); }} />;
  }

  if (screen === "question" && question) {
    return (
      <QuestionScreen
        level={level}
        question={question}
        qIndex={qIdx}
        totalQ={level.questions.length}
        totalLevels={LEVELS.length}
        stars={levelStars}
        onCorrect={() => { setLevelStars((s) => s + 1); setTotalStars((s) => s + 1); }}
        onNext={() => {
          if (qIdx + 1 < level.questions.length) {
            setQIdx((i) => i + 1);
          } else {
            setScreen("level-complete");
          }
        }}
      />
    );
  }

  if (screen === "level-complete") {
    return (
      <LevelCompleteScreen
        level={level}
        stars={levelStars}
        isLastLevel={levelIdx + 1 >= LEVELS.length}
        onNext={() => {
          if (levelIdx + 1 < LEVELS.length) {
            setLevelIdx((i) => i + 1);
            setScreen("level-intro");
          } else {
            setScreen("done");
          }
        }}
      />
    );
  }

  return <DoneScreen data={data} totalStars={totalStars} maxStars={MAX_STARS} />;
}
