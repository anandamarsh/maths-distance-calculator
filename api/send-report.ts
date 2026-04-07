export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeBody(body: unknown) {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" ? body : null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    res.status(500).json({ error: "Email service is not configured." });
    return;
  }

  const payload = normalizeBody(req.body) as
      | {
        email?: string;
        pdfBase64?: string;
        playerName?: string;
        correctCount?: number;
        totalQuestions?: number;
        accuracy?: number;
        senderName?: string;
        gameName?: string;
        siteUrl?: string;
        sessionTime?: string;
        sessionDate?: string;
        durationText?: string;
        stageLabel?: string;
        curriculumCode?: string;
        curriculumDescription?: string;
        curriculumUrl?: string;
        curriculumIndexUrl?: string;
        reportFileName?: string;
        // Pre-translated email body strings (optional — falls back to English)
        emailSubject?: string;
        emailGreeting?: string;
        emailBodyIntro?: string;
        emailCurriculumIntro?: string;
        emailRegards?: string;
      }
    | null;

  const email = payload?.email?.trim() ?? "";
  const pdfBase64 = payload?.pdfBase64?.trim() ?? "";

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  if (!pdfBase64) {
    res.status(400).json({ error: "Report attachment is missing." });
    return;
  }

  const playerName = (payload?.playerName || "Explorer").trim() || "Explorer";
  const reportFileName = payload?.reportFileName || "distance-report.pdf";
  const scoreLine = `${payload?.correctCount ?? 0}/${payload?.totalQuestions ?? 0}`;
  const accuracy = `${payload?.accuracy ?? 0}%`;
  const senderName = payload?.senderName || "Distance Calculator";
  const gameName = payload?.gameName || "Distance Calculator";
  const siteUrl = payload?.siteUrl || "https://www.seemaths.com";
  const sessionTime = payload?.sessionTime || "Unknown time";
  const sessionDate = payload?.sessionDate || "Unknown date";
  const durationText = payload?.durationText || "an unknown duration";
  const stageLabel = payload?.stageLabel || "NSW Curriculum";
  const curriculumCode = payload?.curriculumCode || "N/A";
  const curriculumDescription =
    payload?.curriculumDescription || "No curriculum description supplied.";
  const curriculumUrl = payload?.curriculumUrl || "https://www.seemaths.com";
  const curriculumIndexUrl =
    payload?.curriculumIndexUrl ||
    "https://www.educationstandards.nsw.edu.au/wps/portal/nesa/k-10/learning-areas/mathematics/mathematics-k-10";
  const curriculumText = `${curriculumCode} - ${curriculumDescription}`;

  // Use pre-translated strings if provided, otherwise fall back to English plain text
  const emailSubject = payload?.emailSubject || `${gameName} Report`;
  const emailGreeting = payload?.emailGreeting || "Hi there,";
  const emailBodyIntro = payload?.emailBodyIntro ||
    `A player played ${gameName} at SeeMaths at ${sessionTime} on ${sessionDate} for ${durationText}. They scored ${scoreLine} and had an accuracy of ${accuracy}.`;
  const emailCurriculumIntro = payload?.emailCurriculumIntro ||
    `This game is equivalent to ${stageLabel} on topic ${curriculumText}.`;
  const emailRegards = payload?.emailRegards || "Regards,";

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${senderName} <${from}>`,
      to: [email],
      subject: emailSubject,
      html: `
        <p>${escapeHtml(emailGreeting)}</p>
        <p>${escapeHtml(emailBodyIntro)}</p>
        <p>${escapeHtml(emailCurriculumIntro)} <a href="${escapeHtml(curriculumUrl)}">${escapeHtml(curriculumText)}</a></p>
        <p>
          ${escapeHtml(emailRegards)}<br />
          ${escapeHtml(gameName)}<br />
          <a href="${escapeHtml(siteUrl)}">SeeMaths</a>
        </p>
      `,
      attachments: [
        {
          filename: reportFileName,
          content: pdfBase64,
        },
      ],
    }),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    console.error("Resend send failed:", errorText);
    res.status(502).json({ error: "Report email could not be sent." });
    return;
  }

  res.status(200).json({ ok: true });
}
