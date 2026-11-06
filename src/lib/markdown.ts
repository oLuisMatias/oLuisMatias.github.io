// The markdown of the site's text. Raw HTML in the text is shown as text, and links keep to safe addresses.
import { Marked } from "marked";
import { safeUrl } from "./safe-url";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const markdown = new Marked({
  walkTokens(token) {
    if (token.type === "html") token.text = escape(token.text);
    if (token.type === "link" || token.type === "image") token.href = safeUrl(token.href);
  },
});
