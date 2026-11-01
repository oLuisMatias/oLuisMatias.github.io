# lmatias.com

Portfolio of Luis Matias, Mechanical Design Engineer. Built with [Astro](https://astro.build), edited with [Sveltia CMS](https://sveltiacms.app) and hosted on Cloudflare: one Worker that serves the built site as static assets.

## Private area (`/admin`)

Everything under `/admin` is for the owner only. On Cloudflare it is protected by **Cloudflare Access** (login with the owner's email). The start page `/admin` links to the tools:

| Tool | Address | Status |
|---|---|---|
| Content editor | `/admin/editor/` | ready (needs the one-time setup below) |
| Documents, CV builder, letter builder | `/admin/...` | planned |

### Content editor

Edit projects, 3D prints, CV entries and site settings in forms; every save is a commit on `main`, and Cloudflare rebuilds the site in about a minute. Every entry has a **Visible on website** switch, and a lower **Order** number puts it first.

**How you sign in:** open `/admin`, enter your email, and type the code Cloudflare sends you (Cloudflare Access). Then open the editor and click **Sign In with GitHub**. There is no GitHub screen: after checking your Access ticket, the site's Worker (`worker/admin-auth.ts`) hands the editor the GitHub token stored as a secret in Cloudflare. The check is in `worker/access.ts` and is tested with `npm test`; it refuses anyone without a valid ticket for the owner's email.

**One-time setup**

1. **GitHub token:** GitHub › Settings › Developer settings › Personal access tokens › Fine-grained tokens › Generate. Resource owner: you; repository access: only `oLuisMatias.github.io`; permission *Contents: Read and write*; expiration: 1 year. In Cloudflare › Workers & Pages › lmatias › Settings › Variables and Secrets add a **Secret** named `GITHUB_TOKEN`. Renew it before it expires.
2. **Cloudflare Access:** Zero Trust › Access › Applications: protect `lmatias.com/admin*` (and the `*.workers.dev` test address) with a policy that allows only the owner's email.
3. **Tell the Worker about the lock:** copy the team domain (`https://<team>.cloudflareaccess.com`) and the application's AUD tag into `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.toml`, then push. Until they are set, the sign-in refuses everyone.

Without the setup, **Work with Local Repository** (Chrome or Edge, select this folder) still works for editing on your own computer.

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

`npm test` runs the tests of the sign-in check. To try the Worker locally: `npm run build`, then `npx wrangler dev` (the editor's sign-in stays refused locally because there is no Access ticket; use *Work with Local Repository* there).

## Publishing

Cloudflare builds from this repository on every push to `main`: build command `npm run build`, deploy command `npx wrangler deploy`. Settings live in `wrangler.toml`; the Worker code is in `worker/`.
