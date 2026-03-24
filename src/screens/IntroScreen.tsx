import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import type { AnalysisData } from "../types";

interface Props {
  data: AnalysisData;
  onStart: () => void;
}

export default function IntroScreen({ data, onStart }: Props) {
  const topicLabel = data.id.split("-").slice(2).join(" ").replace(/_/g, " ");
  const incorrectCount = data.incorrect.reduce((s, c) => s + c.questionCount, 0);
  const correctCount = data.correct.reduce((s, c) => s + c.questionCount, 0);

  return (
    <Box sx={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", p: 2, bgcolor: "#f5f7fa" }}>
      <Box sx={{ maxWidth: 520, width: "100%", bgcolor: "white", borderRadius: 3, p: 4, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Box sx={{ bgcolor: "#e8f4fd", borderRadius: 2, p: 1.2, display: "flex" }}>
            <SchoolIcon sx={{ color: "#1976d2", fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="overline" sx={{ color: "#888", lineHeight: 1 }}>Let's practise</Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2, textTransform: "capitalize" }}>
              {topicLabel}
            </Typography>
          </Box>
        </Box>

        <Typography variant="body1" sx={{ color: "#444", lineHeight: 1.7, mb: 3 }}>
          {data.summary}
        </Typography>

        <Stack direction="row" spacing={1.5} sx={{ mb: 4 }}>
          <Chip label={`${correctCount} correct`} sx={{ bgcolor: "#e8f5e9", color: "#2e7d32", fontWeight: 600 }} />
          <Chip label={`${incorrectCount} to work on`} sx={{ bgcolor: "#fff3e0", color: "#e65100", fontWeight: 600 }} />
        </Stack>

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={onStart}
          sx={{ borderRadius: 2, py: 1.5, fontSize: 16, fontWeight: 700, textTransform: "none", bgcolor: "#1976d2" }}
        >
          Start lesson →
        </Button>
      </Box>
    </Box>
  );
}
