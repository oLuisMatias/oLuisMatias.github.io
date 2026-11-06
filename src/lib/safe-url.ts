// Links written in the editors end up in href attributes on the public site. Only web, mail and phone links and
// relative addresses are allowed; anything else (javascript:, data:, ...) becomes "#".
export function safeUrl(url: string): string {
  const bare = url.replace(/[\u0000- ]/g, ""); // browsers ignore spaces and line breaks inside a scheme
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(bare)?.[1]?.toLowerCase();
  return !scheme || ["http", "https", "mailto", "tel"].includes(scheme) ? url : "#";
}
