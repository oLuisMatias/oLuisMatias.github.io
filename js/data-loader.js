const SHEET_ID = '1gT2fLInodV6ohZQd4eBoyqGWmZG0vK31Yp3UFJ_XkUQ';

const SHEETS = {
  work:           { gid: 0 },
  projects:       { gid: 1451783063 },
  education:      { gid: 1174712494 },
  experiences:    { gid: 167754228 },
  certifications: { gid: 740183675 },
};

// ── Fetch & parse ─────────────────────────────────────

async function fetchSheet(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet gid=${gid} failed: ${res.status}`);
  return parseCSV(await res.text());
}

function parseCSV(csv) {
  const rows = [];
  let row = [], field = '', inQ = false;

  for (let i = 0; i < csv.length; i++) {
    const c = csv[i], n = csv[i + 1];
    if (c === '"' && n === '"' && inQ) { field += '"'; i++; }
    else if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { row.push(field.trim()); field = ''; }
    else if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && n === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.some(f => f)) rows.push(row);
      row = [];
    } else { field += c; }
  }
  row.push(field.trim());
  if (row.some(f => f)) rows.push(row);

  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

// ── Helpers ───────────────────────────────────────────

function flagImg(code, label) {
  if (!code) return '';
  return `<img src="https://flagcdn.com/16x12/${code.toLowerCase()}.png" alt="${label}">`;
}

function parseLines(val) {
  if (!val) return [];
  return val.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n').map(s => s.trim()).filter(Boolean);
}

function parseTools(val) {
  if (!val) return [];
  return val.split(',').map(t => t.trim()).filter(Boolean);
}

// Resolve image without knowing extension — tries png, svg, jpg, webp in order
const EXT_ORDER = ['png', 'svg', 'jpg', 'jpeg', 'webp'];

function resolveImage(folder, name) {
  if (!name) return '';
  if (/\.(png|svg|jpg|jpeg|webp)$/i.test(name)) return `${folder}/${name}`;
  return `${folder}/${name}.png`;
}

// Expose globally so inline onerror handlers can call it
window.tryNextExt = function(img, base) {
  const current = img.src.split('.').pop().split('?')[0].toLowerCase();
  const idx = EXT_ORDER.indexOf(current);
  if (idx >= 0 && idx < EXT_ORDER.length - 1) {
    img.src = `${base}.${EXT_ORDER[idx + 1]}`;
  } else {
    img.style.display = 'none'; // all failed, hide
  }
};

function parsePapers(row) {
  const src = row.papers || [row.paper1, row.paper2, row.paper3].filter(Boolean).join('\n');
  return parseLines(src).map(p => {
    if (p.includes('|')) {
      const [title, url] = p.split('|').map(s => s.trim());
      return { title, url };
    }
    return { title: p, url: null };
  });
}

function toolsHTML(tools, section) {
  if (!tools.length) return '';
  return `<div class="cv__card-tags">
    ${tools.map(t => {
      const name = t.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '')
        .split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const base = t.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '');
      const src = resolveImage('images/skills', t);
      return `<div class="tool-item">
        <img src="${src}" alt="${name}" class="tool-icon" onerror="window.tryNextExt(this,'images/skills/${base}')">
        <span class="tool-label">${name}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function papersHTML(papers) {
  if (!papers.length) return '';
  return `<div class="cv__card-papers">
    <span class="cv__card-papers-label">Published Paper:</span>
    ${papers.map(p => `<span class="cv__card-thesis">${p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${p.title}</a>` : p.title}</span>`).join('')}
  </div>`;
}

function cardHTML({ title, date, subtitle, subtitleLink, location, countryCode, logo, bullets, thesis, papers, tools }) {
  const logoBase = logo ? logo.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '') : '';
  return `
  <div class="cv__card">
    <div class="cv__card-main">
      <div class="cv__card-title" style="font-size:1.2rem;">${title}</div>
      <div class="cv__card-date">${date}</div>
      <div class="cv__card-company">${subtitleLink ? `<a href="${subtitleLink}" target="_blank" rel="noopener">${subtitle}</a>` : subtitle}</div>
      ${thesis ? `<p class="cv__card-thesis">${thesis}</p>` : ''}
      ${bullets.length ? `<ul>${bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
      ${papersHTML(papers)}
      ${toolsHTML(tools)}
    </div>
    <div class="cv__card-side">
      ${location ? `<div class="cv__card-location">${flagImg(countryCode, countryCode)} ${location}</div>` : ''}
      ${logo ? `<div class="cv__card-logo">${subtitleLink ? `<a href="${subtitleLink}" target="_blank" rel="noopener">` : ''}<img src="${logo}" alt="${subtitle}" onerror="window.tryNextExt(this,'${logoBase}')">${subtitleLink ? '</a>' : ''}</div>` : ''}
    </div>
  </div>`;
}

// ── Renderers ─────────────────────────────────────────

function renderWork(data) {
  const body = document.querySelector('#section-work');
  if (!body) return;
  body.innerHTML = data.map(row => cardHTML({
    title: row.title,
    date: row.period,
    subtitle: row.company,
    subtitleLink: row.link,
    location: row.location,
    countryCode: row.countryCode || row.countrycode,
    logo: resolveImage('images/cv/work', row.companyLogo),
    bullets: parseLines(row.responsibilities),
    papers: parsePapers(row),
    tools: parseTools(row.tools),
  })).join('');
}

function educationCardHTML({ title, date, subtitle, subtitleLink, location, countryCode, logo, thesis, papers, tools }) {
  const logoBase = logo ? logo.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '') : '';
  return `
  <div class="cv__card cv__card--edu">
    <div class="cv__card-edu-header">
      <div class="cv__card-title" style="font-size:1.2rem;">${title}</div>
      <div class="cv__card-date">${date}</div>
    </div>
    <div class="cv__card-edu-body">
      <div class="cv__card-company">${subtitleLink ? `<a href="${subtitleLink}" target="_blank" rel="noopener">${subtitle}</a>` : subtitle}</div>
      ${location ? `<div class="cv__card-location">${flagImg(countryCode, countryCode)} ${location}</div>` : ''}
      ${thesis ? `<p class="cv__card-thesis"><strong>Thesis:</strong> ${thesis}</p>` : ''}
      ${papersHTML(papers)}
    </div>
    <div class="cv__card-edu-footer">
      ${tools.length ? `<div class="cv__card-software"><span class="cv__card-papers-label">Software:</span>${toolsHTML(tools)}</div>` : ''}
      ${logo ? `<div class="cv__card-logo cv__card-logo--bottom">${subtitleLink ? `<a href="${subtitleLink}" target="_blank" rel="noopener">` : ''}<img src="${logo}" alt="${subtitle}" onerror="window.tryNextExt(this,'${logoBase}')">${subtitleLink ? '</a>' : ''}</div>` : ''}
    </div>
  </div>`;
}

function renderEducation(data) {
  const body = document.querySelector('#section-studies');
  if (!body) return;
  body.innerHTML = `<div class="cv__cards-row">${data.map(row => educationCardHTML({
    title: row.degree,
    date: row.period,
    subtitle: row.institution,
    subtitleLink: row.link,
    location: row.location,
    countryCode: row.countryCode || row.countrycode,
    logo: resolveImage('images/cv/studies', row.institutionLogo),
    thesis: row.details,
    papers: parsePapers(row),
    tools: parseTools(row.tools),
  })).join('')}</div>`;
}

function experienceCardHTML({ type, title, date, subtitle, subtitleLink, location, countryCode, logo, bullets }) {
  const logoBase = logo ? logo.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '') : '';
  return `
  <div class="cv__card cv__card--edu">
    <div class="cv__card-edu-header">
      <div class="cv__card-date">${type}</div>
      <div class="cv__card-date">${date}</div>
    </div>
    <div class="cv__card-title" style="margin-bottom:0.3rem;font-size:1.2rem;">${title}</div>
    <div class="cv__card-edu-body">
      <div class="cv__card-company">${subtitleLink ? `<a href="${subtitleLink}" target="_blank" rel="noopener">${subtitle}</a>` : subtitle}</div>
      ${location ? `<div class="cv__card-location">${flagImg(countryCode, countryCode)} ${location}</div>` : ''}
      ${bullets.length ? bullets.map(b => `<p class="cv__card-thesis">• ${b}</p>`).join('') : ''}
    </div>
    <div class="cv__card-edu-footer">
      ${logo ? `<div class="cv__card-logo cv__card-logo--bottom">${subtitleLink ? `<a href="${subtitleLink}" target="_blank" rel="noopener">` : ''}<img src="${logo}" alt="${subtitle}" onerror="window.tryNextExt(this,'${logoBase}')">${subtitleLink ? '</a>' : ''}</div>` : ''}
    </div>
  </div>`;
}

function renderExperiences(data) {
  const body = document.querySelector('#section-experiences');
  if (!body) return;
  body.innerHTML = `<div class="cv__cards-row">${data.map(row => experienceCardHTML({
    type: row.type,
    title: row.title,
    date: row.period,
    subtitle: row.organization,
    subtitleLink: row.link,
    location: row.location,
    countryCode: row.countryCode || row.countrycode,
    logo: resolveImage('images/cv/experiences', row.organizationLogo),
    bullets: [row.description1, row.description2, row.description3].filter(Boolean),
  })).join('')}</div>`;
}

async function renderProjects(data) {
  const body = document.querySelector('#section-projects');
  if (!body) return;

  // Fetch projects sheet for descriptions
  let projectsData = [];
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=150361186`;
    const res = await fetch(url);
    if (res.ok) projectsData = parseCSV(await res.text());
  } catch (e) { /* ignore */ }

  const filtered = data.filter(row => row.title);

  body.innerHTML = `<div class="cv__projects">
    ${filtered.map(row => {
      // Find matching project in projects sheet
      const match = projectsData.find(p => p.title && p.title.toLowerCase() === row.title.toLowerCase());
      const image = row.projectImage || (match && match.banner ? match.banner : 'images/projects/placeholder.svg');
      const description = match && match.description ? match.description.replace(/\\n/g, ' ').split('\n')[0] : '';
      const link = row.link || 'projects.html';
      return `
      <a href="${link}" class="cv__project-item">
        <img src="${image}" alt="${row.title}" onerror="this.style.display='none'">
        <span class="cv__project-item-title">${row.title}</span>
        ${description ? `<span class="cv__project-item-desc">${description}</span>` : ''}
      </a>`;
    }).join('')}
  </div>`;
}

function certificationCardHTML({ title, issuer, period, id, image, pdf, verify }) {
  return `
  <div class="cv__card cv__card--edu">
    <div class="cv__card-edu-header">
      <div class="cv__card-title" style="font-size:1.2rem;">${title}</div>
      <div class="cv__card-date">${period}</div>
    </div>
    <div class="cv__card-edu-body">
      <div class="cv__card-company">${issuer}</div>
      ${id ? `<div class="cv__card-location">${id}</div>` : ''}
    </div>
    <div class="cv__card-edu-footer">
      ${image ? `<div class="cv__card-cert-image"><img src="images/cv/certifications/${image}" alt="${title}" onerror="this.style.display='none'"></div>` : ''}
      <div class="cv__card-cert-actions">
        <div class="cv__card-cert-actions-left">
          ${pdf ? `<button class="btn btn--outline" style="font-size:0.8rem;padding:0.4rem 1rem;font-family:inherit;line-height:1.6;cursor:pointer;" onclick="openPdfModal('data/documents/${pdf}')">View</button>` : ''}
          ${pdf ? `<a href="data/documents/${pdf}" download class="btn btn--outline" style="font-size:0.8rem;padding:0.4rem 1rem;">Download</a>` : ''}
        </div>
        ${verify ? `<a href="data/documents/${verify}" target="_blank" rel="noopener" class="btn btn--outline" style="font-size:0.8rem;padding:0.4rem 1rem;">Verify</a>` : ''}
      </div>
    </div>
  </div>`;
}

function renderCertifications(data) {
  const body = document.querySelector('#section-certifications');
  if (!body) return;
  const filtered = data.filter(row => row.title);
  body.innerHTML = `<div class="cv__cards-row">${filtered.map(row => certificationCardHTML({
    title:  row.title,
    issuer: row.issuer,
    period: row.date,
    id:     row.ID,
    image:  row.image,
    pdf:    row.pdf,
    verify: row.verify,
  })).join('')}</div>`;
}

// ── Init ──────────────────────────────────────────────

async function loadCV() {
  try {
    const [work, projects, education, experiences] = await Promise.all([
      fetchSheet(SHEETS.work.gid),
      fetchSheet(SHEETS.projects.gid),
      fetchSheet(SHEETS.education.gid),
      fetchSheet(SHEETS.experiences.gid),
    ]);

    renderWork(work);
    renderEducation(education);
    renderExperiences(experiences);
    await renderProjects(projects);

    // Certifications loaded separately so it doesn't block the rest
    try {
      const certifications = await fetchSheet(SHEETS.certifications.gid);
      renderCertifications(certifications);
    } catch (e) {
      console.error('Certifications load error:', e);
    }

    document.dispatchEvent(new Event('cvDataLoaded'));
  } catch (err) {
    console.error('CV load error:', err);
    const detail = document.getElementById('cvDetail');
    if (detail) {
      detail.innerHTML = `<div class="cv-detail__loading" style="color:var(--accent);">
        Failed to load CV data. Please try again later.
      </div>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.cv-page') || document.querySelector('.cv')) loadCV();
});

// ── CV sidebar navigation ─────────────────────────────
function initCVNav() {
  const detail = document.getElementById('cvDetail');
  const items  = document.querySelectorAll('.cv-sidebar__item');
  if (!detail || !items.length) return;

  function showSection(name) {
    const src = document.getElementById(`section-${name}`);
    if (!src) return;
    detail.innerHTML = `<div class="cv-detail__panel">${src.innerHTML}</div>`;
  }

  items.forEach(btn => {
    btn.addEventListener('click', () => {
      items.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showSection(btn.dataset.section);
    });
  });

  // Show first active section once data is loaded
  document.addEventListener('cvDataLoaded', () => {
    const active = document.querySelector('.cv-sidebar__item.active');
    if (active) showSection(active.dataset.section);
  });
}

document.addEventListener('DOMContentLoaded', initCVNav);
