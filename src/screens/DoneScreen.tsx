import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import type { AnalysisData } from "../types";

interface Props {
  data: AnalysisData;
}

export default function DoneScreen({ data }: Props) {
  return (
    <Box sx={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", p: 2, bgcolor: "#f5f7fa" }}>
      <Box sx={{ maxWidth: 520, width: "100%", bgcolor: "white", borderRadius: 3, p: 4, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <EmojiEventsIcon sx={{ fontSize: 56, color: "#f9a825", mb: 1 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Lesson complete!</Typography>
          <Typography variant="body1" sx={{ color: "#555" }}>
            You've reviewed all {data.incorrect.length} topics. Now go back to IXL and try again — you've got this.
          </Typography>
        </Box>

        {data.glossary.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#888", mb: 2, textTransform: "uppercase", letterSpacing: 0.8 }}>
              Key terms to remember
            </Typography>
            <Stack spacing={1.5}>
              {data.glossary.map((item) => (
                <Box key={item.term}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.term}</Typography>
                  <Typography variant="body2" sx={{ color: "#555" }}>{item.explanation}</Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}

        <Button
          variant="contained"
          fullWidth
          size="large"
          href="https://www.ixl.com"
          target="_blank"
          sx={{ mt: 4, borderRadius: 2, py: 1.5, fontSize: 16, fontWeight: 700, textTransform: "none", bgcolor: "#2e7d32" }}
        >
          Go to IXL →
        </Button>
      </Box>
    </Box>
  );
}
