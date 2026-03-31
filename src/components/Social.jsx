import {
  FacebookIcon,
  FacebookShareButton,
  LinkedinIcon,
  LinkedinShareButton,
  TwitterIcon,
  TwitterShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from "react-share";

const SHARE_TITLE = "Check out this maths game on Interactive Maths!";
const SHARE_URL = "https://interactive-maths.vercel.app/";
const DEFAULT_DISCUSSIT_URL = import.meta.env.PROD
  ? "https://discussit-widget.vercel.app"
  : "http://localhost:5001";
const LOCAL_DISCUSSIT_URL = (import.meta.env.VITE_DISCUSSIT_URL ?? DEFAULT_DISCUSSIT_URL).replace(/\/$/, "");

export function SocialShare() {
  return (
    <div className="social-share-buttons">
      <TwitterShareButton url={SHARE_URL} title={SHARE_TITLE}>
        <span className="social-share-chip">
          <TwitterIcon size={36} round />
          <span>X</span>
        </span>
      </TwitterShareButton>
      <FacebookShareButton url={SHARE_URL} hashtag="#mathsdistancecalculator">
        <span className="social-share-chip">
          <FacebookIcon size={36} round />
          <span>Facebook</span>
        </span>
      </FacebookShareButton>
      <WhatsappShareButton url={SHARE_URL} title={SHARE_TITLE} separator=" - ">
        <span className="social-share-chip">
          <WhatsappIcon size={36} round />
          <span>WhatsApp</span>
        </span>
      </WhatsappShareButton>
      <LinkedinShareButton url={SHARE_URL} title={SHARE_TITLE} summary={SHARE_TITLE}>
        <span className="social-share-chip">
          <LinkedinIcon size={36} round />
          <span>LinkedIn</span>
        </span>
      </LinkedinShareButton>
    </div>
  );
}

export function SocialComments() {
  const pageUrl = typeof window !== "undefined" ? window.location.href : SHARE_URL;
  const iframeUrl = `${LOCAL_DISCUSSIT_URL}/?url=${encodeURIComponent(pageUrl)}&theme=dark`;
  const openComposer = () => {
    const frame = document.querySelector('iframe[data-discussit-comments="true"]');
    frame?.contentWindow?.postMessage({ type: "discussit:open-composer" }, "*");
  };

  return (
    <div style={{ padding: "0.75rem 1rem 1.25rem", height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={openComposer}
          style={{
            border: "1px solid rgba(250, 204, 21, 0.7)",
            borderRadius: "999px",
            background: "rgba(250, 204, 21, 0.08)",
            color: "#fde047",
            padding: "0.55rem 1rem",
            fontSize: "0.76rem",
            fontWeight: 900,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          New comment
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <iframe
          data-discussit-comments="true"
          src={iframeUrl}
          title="DiscussIt comments"
          style={{
            width: "100%",
            height: "100%",
            minHeight: "100%",
            border: 0,
            borderRadius: "18px",
            background: "transparent",
          }}
        />
      </div>
    </div>
  );
}
