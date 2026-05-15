const PROJECTS_SHEET_ID = '1gT2fLInodV6ohZQd4eBoyqGWmZG0vK31Yp3UFJ_XkUQ';
const PROJECTS_GID = 150361186;

async function fetchProjectsSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${PROJECTS_SHEET_ID}/export?format=csv&gid=${PROJECTS_GID}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Projects sheet failed: ${res.status}`);
  const text = await res.text();
  // parseCSV is defined in data-loader.js which is loaded before this script
  if (typeof parseCSV !== 'function') throw new Error('parseCSV not available');
  return parseCSV(text);
}

async function loadProjects() {
  const sidebar = document.getElementById('projectsSidebar');
  const detail  = document.getElementById('projectsDetail');
  if (!sidebar) return;

  try {
    const data = (await fetchProjectsSheet()).filter(row => row.title);

    if (!data.length) {
      sidebar.innerHTML = '<p style="padding:1rem;color:var(--text-muted);font-size:0.85rem;">No projects yet.</p>';
      return;
    }

    // Group projects by topic
    const grouped = {};
    data.forEach((p, i) => {
      const topic = p.topic || 'Other';
      if (!grouped[topic]) grouped[topic] = [];
      grouped[topic].push({ ...p, _index: i });
    });

    sidebar.innerHTML = Object.entries(grouped).map(([topic, projects]) => `
      <div class="projects-sidebar__group">
        <button class="projects-sidebar__topic" onclick="this.parentElement.classList.toggle('collapsed')">
          <span>${topic}</span>
          <span class="projects-sidebar__toggle">−</span>
        </button>
        <div class="projects-sidebar__items">
          ${projects.map(p => `
            <button class="projects-sidebar__item" data-index="${p._index}">
              <img src="${p.banner || 'images/projects/placeholder.svg'}" alt="${p.title}"
                   onerror="this.style.display='none'">
              <span>${p.title}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');

    sidebar.querySelectorAll('.projects-sidebar__item').forEach(btn => {
      btn.addEventListener('click', () => {
        sidebar.querySelectorAll('.projects-sidebar__item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderDetail(detail, data[+btn.dataset.index]);
      });
    });

    // Select first by default
    sidebar.querySelector('.projects-sidebar__item')?.click();

  } catch (err) {
    console.error('Projects load error:', err);
    sidebar.innerHTML = '<p style="padding:1rem;color:var(--accent);font-size:0.85rem;">Failed to load projects.</p>';
  }
}

function projectToolsHTML(tools) {
  if (!tools.length) return '';
  return `<div class="cv__card-tags" style="margin-top:1rem;">
    ${tools.map(t => {
      const name = t.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '')
        .split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const base = t.replace(/\.(png|svg|jpg|jpeg|webp)$/i, '');
      const src = /\.(png|svg|jpg|jpeg|webp)$/i.test(t) ? `images/skills/${t}` : `images/skills/${t}.png`;
      return `<div class="tool-item">
        <img src="${src}" alt="${name}" class="tool-icon" onerror="window.tryNextExt(this,'images/skills/${base}')">
        <span class="tool-label">${name}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function renderDetail(container, p) {
  const tools = p.software ? p.software.split(',').map(t => t.trim()).filter(Boolean) : [];
  const descriptions = p.description ? p.description.replace(/\\n/g, '\n').split('\n').map(s => s.trim()).filter(Boolean) : [];

  container.innerHTML = `
    <div class="projects-detail__content">
      ${p.banner ? `<div class="projects-detail__image">
        <img src="${p.banner}" alt="${p.title}" onerror="this.style.display='none'">
      </div>` : ''}
      <div class="projects-detail__info">
        <div class="projects-detail__title-row">
          <h1>${p.title}</h1>
          ${p.cadFile ? `<button class="btn btn--outline" id="cadBtn-${Date.now()}">View CAD File</button>` : ''}
        </div>
        <div class="projects-detail__desc">
          ${descriptions.map(d => `<p>${d}</p>`).join('')}
        </div>
        ${projectToolsHTML(tools)}
      </div>
    </div>`;

  // Attach CAD button event listener
  if (p.cadFile) {
    const cadBtn = container.querySelector('[id^="cadBtn-"]');
    if (cadBtn) {
      cadBtn.addEventListener('click', () => {
        if (typeof window.openModel === 'function') {
          window.openModel(p.cadFile, p.title);
        }
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.projects-page')) loadProjects();
});
