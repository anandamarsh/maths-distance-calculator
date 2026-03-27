import { DiscussionEmbed } from "disqus-react";
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

const APP_TITLE = "Interactive Maths";
const SHARE_TITLE = "Check out this maths game on Interactive Maths!";
const DISQUS_SHORTNAME = "interactive-maths";
const GAME_ID = "maths-distance-calculator";

function getCurrentUrl() {
  return typeof window !== "undefined" ? window.location.href : "";
}

export function SocialShare() {
  const url = getCurrentUrl();

  return (
    <div className="social-share-buttons">
      <TwitterShareButton url={url} title={SHARE_TITLE}>
        <span className="social-share-chip">
          <TwitterIcon size={36} round />
          <span>X</span>
        </span>
      </TwitterShareButton>
      <FacebookShareButton url={url} hashtag="#mathsdistancecalculator">
        <span className="social-share-chip">
          <FacebookIcon size={36} round />
          <span>Facebook</span>
        </span>
      </FacebookShareButton>
      <WhatsappShareButton url={url} title={SHARE_TITLE} separator=" - ">
        <span className="social-share-chip">
          <WhatsappIcon size={36} round />
          <span>WhatsApp</span>
        </span>
      </WhatsappShareButton>
      <LinkedinShareButton url={url} title={SHARE_TITLE} summary={SHARE_TITLE}>
        <span className="social-share-chip">
          <LinkedinIcon size={36} round />
          <span>LinkedIn</span>
        </span>
      </LinkedinShareButton>
    </div>
  );
}

export function SocialComments() {
  const url = getCurrentUrl();

  return (
    <DiscussionEmbed
      shortname={DISQUS_SHORTNAME}
      config={{
        url,
        identifier: GAME_ID,
        title: `${APP_TITLE} Discussion`,
      }}
    />
  );
}
