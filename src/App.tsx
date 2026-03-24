import { useEffect, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import type { AnalysisData } from "./types";
import IntroScreen from "./screens/IntroScreen";
import LessonScreen from "./screens/LessonScreen";
import DoneScreen from "./screens/DoneScreen";

type Screen = "loading" | "intro" | "lesson" | "done";

export default function App() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [lessonIndex, setLessonIndex] = useState(0);

  useEffect(() => {
    fetch("/data.json")
      .then((r) => r.json())
      .then((d: AnalysisData) => {
        setData(d);
        setScreen("intro");
      });
  }, []);

  if (screen === "loading" || !data) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  const lessons = data.incorrect.filter((c) => c.howToTeach);

  if (screen === "intro") {
    return <IntroScreen data={data} onStart={() => setScreen("lesson")} />;
  }

  if (screen === "lesson") {
    return (
      <LessonScreen
        lesson={lessons[lessonIndex]}
        index={lessonIndex}
        total={lessons.length}
        onNext={() => {
          if (lessonIndex + 1 < lessons.length) {
            setLessonIndex((i) => i + 1);
          } else {
            setScreen("done");
          }
        }}
      />
    );
  }

  return <DoneScreen data={data} />;
}
