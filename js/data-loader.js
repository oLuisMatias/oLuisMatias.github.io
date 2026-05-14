const SHEET_ID = '1gT2fLInodV6ohZQd4eBoyqGWmZG0vK31Yp3UFJ_XkUQ';

const SHEETS = {
  work:           { gid: 0 },
  projects:       { gid: 1451783063 },
  education:      { gid: 1174712494 },
  experiences:    { gid: 167754228 },
  skills:         { gid: 547470293 },
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
function resolveImage(folder, name) {
  if (!name) return '';
  if (/\.(png|svg|jpg|jpeg|webp)$/i.test(name)) return `${folder}/${name}`;
  // Return a proxy img src that falls through extensions via onerror
  return `${folder}/${name}.png" onerror="tryNextExt(this,'${folder}/${name}')`;
}

const EXT_ORDER = ['png', 'svg', 'jpg', 'jpeg', 'webp'];

function tryNextExt(img, base) {
  const current = img.src.split('.').pop().toLowerCase();
  const idx = EXT_ORDER.indexOf(current);
  if (idx < EXT_ORDER.length - 1) {
    img.src = `${base}.${EXT_ORDER[idx + 1]}`;
  } else {
    img.style.display = 'none'; // all failed, hide
  }
}

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
        <img src="${src}" alt="${name}" class="tool-icon" onerror="tryNextExt(this,'images/skills/${base}')">
        <span class="tool-label">${name}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function papersHTML(papers) {
  if (!papers.length) return '';
  return `<p class="cv__card-papers-label">Published Papers:</p>
  <ul>${papers.map(p => `<li>${p.url ? `<a href="${p.url}" target="_blank" rel="noopener">${p.title}</a>` : p.title}</li>`).join('')}</ul>`;
}

function cardHTML({ title, date, subtitle, subtitleLink, location, countryCode, logo, bullets, thesis, papers, tools }) {
  return `
  <div class="cv__card">
    <div class="cv__card-main">
      <div class="cv__card-title">${title}</div>
      <div class="cv__card-date">${date}</div>
      <div class="cv__card-company">${subtitleLink ? `<a href="${subtitleLink}" target="_blank" rel="noopener">${subtitle}</a>` : subtitle}</div>
      ${thesis ? `<p class="cv__card-thesis">${thesis}</p>` : ''}
      ${bullets.length ? `<ul>${bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
      ${papersHTML(papers)}
      ${toolsHTML(tools)}
    </div>
    <div class="cv__card-side">
      ${location ? `<div class="cv__card-location">${flagImg(countryCode, countryCode)} ${location}</div>` : ''}
      ${logo ? `<div class="cv__card-logo">${subtitleLink ? `<a href="${subtitleLink}" target="_blank" rel="noopener">` : ''}<img src="${logo}" alt="${subtitle}" onerror="tryNextExt(this,'${logo.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '')}')">${subtitleLink ? '</a>' : ''}</div>` : ''}
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

function renderEducation(data) {
  const body = document.querySelector('#section-studies');
  if (!body) return;
  body.innerHTML = data.map(row => cardHTML({
    title: row.degree,
    date: row.period,
    subtitle: row.institution,
    subtitleLink: row.link,
    location: row.location,
    countryCode: row.countryCode || row.countrycode,
    logo: resolveImage('images/cv/studies', row.institutionLogo),
    bullets: [],
    thesis: row.details,
    papers: parsePapers(row),
    tools: parseTools(row.tools),
  })).join('');
}

function renderExperiences(data) {
  const body = document.querySelector('#section-experiences');
  if (!body) return;
  body.innerHTML = data.map(row => cardHTML({
    title: row.title,
    date: row.period,
    subtitle: row.organization,
    subtitleLink: row.link,
    location: row.location,
    countryCode: row.countryCode || row.countrycode,
    logo: resolveImage('images/cv/experiences', row.organizationLogo),
    bullets: [row.description1, row.description2, row.description3].filter(Boolean),
    papers: [],
    tools: [],
  })).join('');
}

function renderSkills(data) {
  const body = document.querySelector('#section-skills');
  if (!body) return;
  const map = {};
  data.forEach(row => {
    if (!row.category) return;
    map[row.category] = [row.skill1, row.skill2, row.skill3, row.skill4, row.skill5, row.skill6].filter(Boolean);
  });
  body.innerHTML = `<div class="cv__skills-grid">
    ${Object.entries(map).map(([cat, skills]) => `
      <div class="cv__skill-category">
        <h4>${cat}</h4>
        <ul>${skills.map(s => `<li>${s}</li>`).join('')}</ul>
      </div>`).join('')}
  </div>`;
}

function renderProjects(data) {
  const body = document.querySelector('#section-projects');
  if (!body) return;
  body.innerHTML = `<div class="cv__projects">
    ${data.map(row => `
      <a href="${row.link || '#'}" class="cv__project-item">
        <img src="${row.projectImage || 'images/projects/placeholder.jpg'}" alt="${row.title}">
        <span>${row.title}</span>
      </a>`).join('')}
  </div>`;
}

// ── Init ──────────────────────────────────────────────

async function loadCV() {
  try {
    const [work, projects, education, experiences, skills] = await Promise.all([
      fetchSheet(SHEETS.work.gid),
      fetchSheet(SHEETS.projects.gid),
      fetchSheet(SHEETS.education.gid),
      fetchSheet(SHEETS.experiences.gid),
      fetchSheet(SHEETS.skills.gid),
    ]);

    renderWork(work);
    renderEducation(education);
    renderExperiences(experiences);
    renderSkills(skills);
    renderProjects(projects);

    document.dispatchEvent(new Event('cvDataLoaded'));
  } catch (err) {
    console.error('CV load error:', err);
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
