# lmatias.com

Portfolio of Luis Matias, Mechanical Design Engineer. Built with [Astro](https://astro.build), edited with [Sveltia CMS](https://sveltiacms.app) and hosted on Cloudflare Pages.

## Private area (`/admin`)

Everything under `/admin` is for the owner only. On Cloudflare it is protected by **Cloudflare Access** (login with the owner's email). The start page `/admin` links to the tools:

| Tool | Address | Status |
|---|---|---|
| Content editor | `/admin/editor/` | ready (needs the one-time setup below) |
| Documents, CV builder, letter builder | `/admin/...` | planned |

### Content editor

Edit projects, 3D prints, CV entries and site settings in forms; every save is a commit on `main`, and Cloudflare rebuilds the site in about a minute. Every entry has a **Visible on website** switch, and a lower **Order** number puts it first.

Sign in with **Sign In with GitHub**. It works through two small functions of this site, `functions/admin/auth.ts` and `functions/admin/callback.ts`, so there is no separate service to run. The signed-in GitHub account needs write access to the repository.

**One-time setup**

1. **GitHub OAuth app:** GitHub › Settings › Developer settings › OAuth Apps › New. Homepage URL `https://lmatias.com`, **Authorization callback URL** `https://lmatias.com/admin/callback`. Copy the Client ID and create a Client secret.
2. **Cloudflare Pages › Settings › Variables and Secrets:** add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (as encrypted secrets).
3. **Cloudflare Zero Trust › Access › Applications:** add a self-hosted application for `lmatias.com/admin*` with a policy that allows only the owner's email.
4. Testing on a `*.pages.dev` address before the domain is switched: in `public/admin/editor/config.yml`, temporarily set `base_url` to that address, and use it as the OAuth app's callback host.

Without the setup, **Sign In Using Access Token** (a GitHub personal access token with *Contents: Read and write*) and **Work with Local Repository** (Chrome or Edge, select this folder) still work.

## Content files

All content is plain YAML in the repo:

- `src/content/projects/`, `prints/`, `work/`, `education/`, `experiences/`, `certifications/`: one file per entry
- `src/data/site.yml`: site settings; `src/data/tools.yml`: tool list
- `public/`: images, PDFs and 3D models (`public/images/uploads/` for editor uploads)

## Running locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # output in dist/
```

To try the private functions locally, put `GITHUB_CLIENT_ID=...` and `GITHUB_CLIENT_SECRET=...` in a `.dev.vars` file (ignored by git), then run `npm run build` and `npx wrangler pages dev dist`.

## Publishing

Cloudflare Pages builds from this repository on every push to `main`: build command `npm run build`, output directory `dist`.
