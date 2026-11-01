// What the Worker receives from Cloudflare: the site's files, plus the settings and secrets of the project.
export interface Env {
  /** The built site (the dist/ folder). */
  ASSETS: Fetcher;
  /** Secret: a GitHub token limited to this one repository ("Contents: Read and write"). */
  GITHUB_TOKEN?: string;
  /** The login lock (Cloudflare Access): see wrangler.toml. */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** The only email that may use the private area. */
  OWNER_EMAIL?: string;
}
