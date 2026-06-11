import "server-only";
import sanitizeHtml from "sanitize-html";

// The public API returns `description_html` and `consent_disclosure_html` as raw
// HTML authored in the Kit account. A forkable template must NOT trust that
// blindly: a compromised (or malicious-admin) Kit account could otherwise inject
// stored XSS into every applicant's browser on the deployed site. We sanitize on
// the server, at the data-fetch boundary, so every render site receives safe HTML.

const linkTransform = sanitizeHtml.simpleTransform("a", {
  rel: "noopener noreferrer nofollow",
  target: "_blank",
});

/** Rich text for a job description: common formatting tags, safe links only. */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "span", "div",
      "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote",
      "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "a",
    ],
    allowedAttributes: { a: ["href", "name", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: { a: linkTransform },
  });
}

/** Short consent disclosure: links only (mirrors Kit's first-party portal). */
export function sanitizeConsentHtml(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: ["a", "br", "strong", "em", "p"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: linkTransform },
  });
}
