import { useState } from "react";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import type { AnalysisCategory } from "../types";

type Step = "why" | "teach" | "check";

interface Props {
  lesson: AnalysisCategory;
  index: number;
  total: number;
  onNext: () => void;
}

export default function LessonScreen({ lesson, index, total, onNext }: Props) {
  const [step, setStep] = useState<Step>("why");

  const progress = ((index) / total) * 100;

  return (
    <Box sx={{ minHeight: "100svh", display: "flex", flexDirection: "column", bgcolor: "#f5f7fa" }}>
      <Box sx={{ bgcolor: "white", px: 3, pt: 2, pb: 1.5, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="caption" sx={{ color: "#888", fontWeight: 600 }}>
            TOPIC {index + 1} OF {total}
          </Typography>
          <Typography variant="caption" sx={{ color: "#1976d2", fontWeight: 700 }}>
            {Math.round(progress)}% done
          </Typography>
        </Stack>
        <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 4, height: 6 }} />
      </Box>

      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
        <Box sx={{ maxWidth: 520, width: "100%" }}>
          <Typography variant="overline" sx={{ color: "#888", display: "block", mb: 0.5 }}>
            {lesson.category}
          </Typography>

          {step === "why" && (
            <Card
              icon={<ErrorOutlineIcon sx={{ color: "#e65100", fontSize: 26 }} />}
              bgcolor="#fff8f0"
              border="#ffe0b2"
              title="What went wrong"
              body={lesson.whyWrong}
              buttonLabel="Show me how to fix it →"
              onNext={() => setStep("teach")}
            />
          )}

          {step === "teach" && (
            <Card
              icon={<LightbulbOutlinedIcon sx={{ color: "#1976d2", fontSize: 26 }} />}
              bgcolor="#f0f7ff"
              border="#bbdefb"
              title="How to think about it"
              body={lesson.howToTeach}
              buttonLabel="Got it — check my understanding →"
              onNext={() => setStep("check")}
            />
          )}

          {step === "check" && (
            <Card
              icon={<CheckCircleOutlineIcon sx={{ color: "#2e7d32", fontSize: 26 }} />}
              bgcolor="#f1f8f2"
              border="#c8e6c9"
              title="You'll know you've got it when..."
              body={lesson.ifTheyUnderstand}
              buttonLabel={index + 1 < total ? "Next topic →" : "Finish lesson →"}
              onNext={() => { setStep("why"); onNext(); }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

function Card({
  icon, bgcolor, border, title, body, buttonLabel, onNext,
}: {
  icon: React.ReactNode;
  bgcolor: string;
  border: string;
  title: string;
  body: string;
  buttonLabel: string;
  onNext: () => void;
}) {
  return (
    <Box sx={{ bgcolor, border: `1.5px solid ${border}`, borderRadius: 3, p: 3 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
        {icon}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>{title}</Typography>
      </Stack>
      <Typography variant="body1" sx={{ color: "#333", lineHeight: 1.75, mb: 3 }}>{body}</Typography>
      <Button
        variant="contained"
        fullWidth
        size="large"
        onClick={onNext}
        sx={{ borderRadius: 2, py: 1.4, fontSize: 15, fontWeight: 700, textTransform: "none", bgcolor: "#1976d2" }}
      >
        {buttonLabel}
      </Button>
    </Box>
  );
}
