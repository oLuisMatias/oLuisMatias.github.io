# lmatias.com

Portfolio of Luis Matias, Mechanical Design Engineer. Built with [Astro](https://astro.build) and hosted on Cloudflare: one Worker that serves the built site as static assets.

## Private area (`/admin`)

Everything under `/admin` is for the owner only. On Cloudflare it is protected by **Cloudflare Access** (login with the owner's email, then type the code Cloudflare sends). The start page `/admin` links to the tools. Each tool is its own editor:

| Tool | Address | Status |
|---|---|---|
| Home Page Editor | `/admin/home` | ready |
| Edit Project | `/admin/projects` | ready |
| Project Page Editor | `/admin/project-page` | ready |
| CV Page Editor, 3D Prints Editor | `/admin/...` | planned |
| CV Builder (and letters, documents) | `/admin/...` | planned |

### Edit Project

Edit the project pages on the page itself: the real page is the live preview. A project page is the header, the **Main section** and any number of **Sections**. Every section starts as one box; the menu button at the side of a box divides it into columns or rows (and any new box can be divided again), you choose what goes in each box (text, heading, image, gallery, 3D model, video, table, button, tools and skills, or the project cover or model), and you drag the thin divider between columns to resize them. Text is typed right on the page; everything else opens a small panel beside the box. Boxes swap places when you drag one onto another. The "Default template" button of the main section lays it out as: text and tools on the left, the 3D model or cover on the right. The "Watch the video" button opens the video in a popup.

The private API (`/admin/api/*`) checks the Cloudflare Access ticket on every request (`worker/access.ts`, tested with `npm test`: it refuses anyone without a valid ticket for the owner's email) and only accepts changes sent from the editor itself.

**One-time setup**

1. **GitHub token:** GitHub › Settings › Developer settings › Personal access tokens › Fine-grained tokens › Generate. Resource owner: you; repository access: only `oLuisMatias.github.io`; permission *Contents: Read and write*; expiration: 1 year. In Cloudflare › Workers & Pages › lmatias › Settings › Variables and Secrets add a **Secret** named `GITHUB_TOKEN`. Renew it before it expires.
2. **Cloudflare Access:** Zero Trust › Access › Applications: protect `lmatias.com/admin*` (and the `*.workers.dev` test address) with a policy that allows only the owner's email.
3. **Tell the Worker about the lock:** copy the team domain (`https://<team>.cloudflareaccess.com`) and the application's AUD tag into `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.toml`, then push. Until they are set, the private API refuses everyone.

When running locally (`npm run dev`) the editor needs neither the login nor the token: it saves straight to the files in this folder.

### Home Page Editor

The real home page is the editor: click a text and type (the About text is Markdown), and in "Featured work" pick a template (1x2, 1x3, 2x2 or 2x3: rows x columns) and click each box to choose which project goes there. The texts and the chosen projects are in `src/data/home.yml` (other pages keep using `src/data/site.yml`). Saving works like the Project Editor: one commit on `main` through `/admin/api/home`.

### Project Page Editor

The real Projects page is the editor: click the title, the line above it or the intro text and type; above the projects choose **how many columns** (1 to 4; the rows follow from the number of projects) and **which date order the page opens with** (newest or oldest first). Visitors get a "Date" selector next to the topic filters to switch the order themselves. The settings are in `src/data/projects-page.yml`; the date used is the one written on each project ("March 2025"; projects without a date go last). On a tablet 3 and 4 columns become 2, and on a phone it is always one column.

## Content files

All content is plain YAML in the repo:

- `src/content/projects/`, `prints/`, `work/`, `education/`, `experiences/`, `certifications/`: one file per entry
- `src/data/site.yml`: site settings; `src/data/tools.yml`: tool list
- `public/`: images, PDFs and 3D models (`public/images/projects/` for Project Editor uploads)

## Running locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # output in dist/
```

`npm test` runs the tests of the login check, the editor's API and the project file round trip. The editor's API is refused under `npx wrangler dev` because there is no Access ticket; use `npm run dev` to try the editor.

## Publishing

Cloudflare builds from this repository on every push to `main`: build command `npm run build`, deploy command `npx wrangler deploy`. Settings live in `wrangler.toml`; the Worker code is in `worker/`.
