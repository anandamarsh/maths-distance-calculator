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

function getCommentsPageUrl() {
  if (typeof window === "undefined") return SHARE_URL;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("level");
    return url.toString();
  } catch {
    return window.location.href;
  }
}

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
  const pageUrl = getCommentsPageUrl();
  const iframeUrl = `${LOCAL_DISCUSSIT_URL}/?url=${encodeURIComponent(pageUrl)}&theme=dark`;

  return (
    <div style={{ padding: "0", height: "100%", boxSizing: "border-box" }}>
      <iframe
        data-discussit-comments="true"
        src={iframeUrl}
        title="DiscussIt comments"
        style={{
          width: "100%",
          height: "100%",
          minHeight: "100%",
          border: 0,
          borderRadius: "0",
          background: "transparent",
        }}
      />
    </div>
  );
}

export function openCommentsComposer() {
  const frame = document.querySelector('iframe[data-discussit-comments="true"]');
  frame?.contentWindow?.postMessage({ type: "discussit:open-composer" }, "*");
}
