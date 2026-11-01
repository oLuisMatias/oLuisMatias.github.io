// What the Worker receives from Cloudflare: the site's files, plus the settings and secrets of the project.
export interface Env {
  /** The built site (the dist/ folder). */
  ASSETS: Fetcher;
  /** Secrets of the GitHub OAuth app, set in the Cloudflare dashboard. */
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  OWNER_EMAIL?: string;
}
