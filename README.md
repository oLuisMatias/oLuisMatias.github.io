# lmatias.com

Portfolio of Luis Matias, Mechanical Design Engineer. Built with [Astro](https://astro.build) and hosted on Cloudflare: one Worker that serves the built site as static assets.

## Private area (`/admin`)

Everything under `/admin` is for the owner only. On Cloudflare it is protected by **Cloudflare Access** (login with the owner's email, then type the code Cloudflare sends). The start page `/admin` links to the tools. Each tool is its own editor:

| Tool | Address | Status |
|---|---|---|
| Home Page Editor | `/admin/home` | ready |
| Edit Project | `/admin/projects` | ready |
| Project Page Editor | `/admin/project-page` | ready |
| CV Page Editor | `/admin/cv` | ready |
| CV Builder | `/admin/cv-builder` | ready |
| 3D Prints Editor | `/admin/...` | planned |
| Motivation letters, Documents page | `/admin/...` | planned |

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

### CV Builder

`/admin/cv-builder` is the history of your saved CVs, newest first (numbered by their date: the oldest is v1). Click a CV to see its PDF; **New version** opens the editor; **Upload an old PDF** adds a CV that exists only as a PDF.

- **Drafts and locking.** A CV you build starts as a *draft*: **Edit** changes it in place. **Lock** (or putting it on the website) makes it final; after that it can be copied with **Duplicate & edit**, or opened again with **Unlock** (then **Edit** changes it in place, even if it is on the website; saving locks it again if it was in use).
- **One content, six templates.** The editor (`/admin/cv-edit`) edits the content once: header, skills, and the entries of Work, Studies, My projects, Experiences and Certifications (reorder, hide, bold selected words with **B** or Ctrl+B). Every CV has six templates: *Normal*, *Photo left* and *No photo*, each with the phone number shown or hidden ("no phone"). Above the page you choose which one you look at.
- **Look per layout.** In the *Look* tab the text size, line spacing and 16 gaps (in mm, typed or with a slider; the gap you point at is marked pink on the page) are set for each layout; a "no phone" template shares the look of its layout.
- **The preview is the PDF.** `src/lib/pdf-cv-document.ts` is the only place the CV's look is defined: it builds the PDF with pdfmake, and the preview shows that same PDF with pdf.js. **Export PDF** downloads the template you are looking at; **Save version** makes all six PDFs.
- **The CV page follows the CV in use.** `/cv` shows the text, the order and the hidden parts of the CV that is in use (`src/lib/cv-live.ts`): Work, Education, Certifications, Publications (the papers) and Other experience. Logos, links and tool chips are not part of a CV's content, so they come from the CV Page Editor's cards (`src/content/...`) when an entry matches one (same company, institution or badge); an entry with no card is shown without them. "My projects" has its own pages, and the Skills box still comes from the CV Page Editor. Putting another CV in use changes `src/data/cv-versions.yml`, which rebuilds the site, so the page follows by itself. If the CV in use is only a PDF (v1, v2), the page shows the CV Page Editor's cards as before.
- **The download link.** The CV page's *Download CV* link offers the CV in use. Only a "no phone" template can be put on the website (from the **Use on website** list of each history row); every template can be downloaded (the **Download** list of each row).
- **Where it is saved.** A version's content is `src/data/cv-docs/v<n>.yml`, its PDFs are in `public/data/cvs/`, and the list is `src/data/cv-versions.yml`. Saving or deleting a version is one commit (`/admin/api/cv-version`), so the site is rebuilt once. `src/data/cv-document.yml` is the content a first CV starts from.
- **Fonts and icons.** Source Sans 3 (`src/assets/fonts`) and Font Awesome Free icons (`src/assets/cv-icons`); their licenses are in those folders.

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

`npm test` runs the tests of the login check, the editor's API, the project and page files, and the CV builder (versions, the CV template and the six templates). The editor's API is refused under `npx wrangler dev` because there is no Access ticket; use `npm run dev` to try the editor.

## Publishing

Cloudflare builds from this repository on every push to `main`: build command `npm run build`, deploy command `npx wrangler deploy`. Settings live in `wrangler.toml`; the Worker code is in `worker/`.
