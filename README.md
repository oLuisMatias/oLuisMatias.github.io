# lmatias.com

Portfolio of Luis Matias, Mechanical Design Engineer. Built with [Astro](https://astro.build), edited with [Sveltia CMS](https://github.com/sveltia/sveltia-cms) and hosted on GitHub Pages.

## Editing content

Go to **lmatias.com/admin** and choose **Sign in using access token**. Paste a GitHub personal access token (fine-grained, this repository only, permission *Contents: Read and write*). Every save becomes a commit on `main`, and the site rebuilds in about 1–2 minutes.

| In the admin | Where it shows |
|---|---|
| Projects | Projects page, project pages, Home (max 3 with "Show on home page") |
| 3D Prints | 3D Prints page and the Home "Latest prints" strip |
| CV · Work / Certifications / Education / Other experience | CV page |
| Settings › Site settings | Name, headline, about, photo, CV PDF, skills, languages, email, EmailJS ids |
| Settings › Tools | The tool list you pick from everywhere (name + icon) |

Every entry has a **Visible on website** switch, and a lower **Order** number puts it first.

## Content files

All content is plain YAML in the repo:

- `src/content/projects/`, `prints/`, `work/`, `education/`, `experiences/`, `certifications/`: one file per entry
- `src/data/site.yml`: site settings; `src/data/tools.yml`: tool list
- `public/`: images, PDFs and 3D models (`public/images/uploads/` for admin uploads)

## Running locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # output in dist/
```

## Publishing

`.github/workflows/deploy.yml` builds and deploys on every push to `main`. In the repository settings, **Pages › Build and deployment › Source** must be **GitHub Actions**.
