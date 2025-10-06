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

// Extended tags for article content (admin-created)
const ARTICLE_ALLOWED_TAGS = [
  // Text formatting
  "p", "br", "strong", "b", "em", "i", "u", "s", "mark", "small", "sub", "sup",
  // Headings
  "h1", "h2", "h3", "h4", "h5", "h6",
  // Lists
  "ul", "ol", "li",
  // Links
  "a",
  // Quotes and code
  "blockquote", "code", "pre",
  // Tables
  "table", "thead", "tbody", "tr", "th", "td",
  // Media (images only, no scripts)
  "img", "figure", "figcaption",
  // Semantic elements
  "article", "section", "aside", "nav", "header", "footer",
  "div", "span",
  // Line breaks
  "hr",
];

const ARTICLE_ALLOWED_ATTR = [
  "href", "target", "rel",      // Links
  "src", "alt", "width", "height", "loading", // Images
  "class", "id",                 // Styling (safe - no inline styles)
  "title",                       // Tooltips
  "colspan", "rowspan",          // Tables
];

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

/**
 * SECURITY: Sanitize article content while preserving all safe formatting
 * 
 * This is specifically for admin-created article content.
 * Removes dangerous elements (script, iframe, object, embed, etc.) while
 * preserving all legitimate HTML formatting.
 * 
 * Safe to use - will NOT break content formatting.
 */
export function sanitizeArticleContent(content: string): string {
  if (!content || content.trim() === "") {
    return content;
  }

  return purify.sanitize(content, {
    ALLOWED_TAGS: ARTICLE_ALLOWED_TAGS,
    ALLOWED_ATTR: ARTICLE_ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    // Keep relative URLs (safe for same-origin images)
    ALLOW_UNKNOWN_PROTOCOLS: false,
    // Remove scripts and event handlers
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover", "style"],
  });
}
