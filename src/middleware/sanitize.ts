import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const purify = DOMPurify(window as any);

// Configure DOMPurify
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "a", "ul", "ol", "li",
  "blockquote", "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6"
];

const ALLOWED_ATTR = ["href", "target", "rel"];

export function sanitizeHtml(dirty: string): string {
  return purify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

export function sanitizeCommentContent(content: string): string {
  // For comments, be more restrictive
  return purify.sanitize(content, {
    ALLOWED_TAGS: ["p", "br", "strong", "em", "a"],
    ALLOWED_ATTR: ["href"],
    ALLOW_DATA_ATTR: false,
  });
}

export function sanitizeText(text: string): string {
  // Strip all HTML tags
  return purify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}
