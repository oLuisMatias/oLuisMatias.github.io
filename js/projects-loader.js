const PROJECTS_GID = 150361186;

async function loadProjects() {
  const sidebar = document.getElementById('projectsSidebar');
  const detail  = document.getElementById('projectsDetail');
  if (!sidebar) return;

  try {
    const data = (await fetchSheetCached(PROJECTS_GID)).filter(row => row.title);

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

    const isSmall = window.innerWidth < 1000;
    sidebar.innerHTML = Object.entries(grouped).map(([topic, projects]) => `
      <div class="projects-sidebar__group${isSmall ? ' collapsed' : ''}">
        <button class="projects-sidebar__topic" onclick="toggleTopicGroup(this)">
          <span>${topic}</span>
          <span class="projects-sidebar__toggle"></span>
        </button>
        <div class="projects-sidebar__items">
          ${projects.map(p => `
            <button class="projects-sidebar__item" data-index="${p._index}">
              <img src="images/projects/${p.banner || 'placeholder.svg'}" alt="${p.title}"
                   onerror="this.style.display='none'">
              <span>${p.title}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');

    function slugify(text) {
      return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    function getProjectHash(p) {
      const topic = slugify(p.topic || 'other');
      const title = slugify(p.title || '');
      return `${topic}_${title}`;
    }

    sidebar.querySelectorAll('.projects-sidebar__item').forEach(btn => {
      btn.addEventListener('click', () => {
        sidebar.querySelectorAll('.projects-sidebar__item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const idx = +btn.dataset.index;
        const hash = getProjectHash(data[idx]);
        history.pushState({ project: idx }, '', `#${hash}`);
        renderDetail(detail, data[idx]);
      });
    });

    // Find project index by hash
    function findByHash(hash) {
      return data.findIndex(p => getProjectHash(p) === hash);
    }

    // Handle back/forward
    window.addEventListener('popstate', (e) => {
      const idx = e.state?.project ?? findByHash(location.hash.replace('#', ''));
      if (idx >= 0 && data[idx]) {
        sidebar.querySelectorAll('.projects-sidebar__item').forEach(b => b.classList.remove('active'));
        const target = sidebar.querySelector(`[data-index="${idx}"]`);
        if (target) target.classList.add('active');
        renderDetail(detail, data[idx]);
      }
    });

    // Restore from hash or select first
    const hashIdx = findByHash(location.hash.replace('#', ''));
    if (hashIdx >= 0) {
      const target = sidebar.querySelector(`[data-index="${hashIdx}"]`);
      if (target) target.click();
    } else {
      sidebar.querySelector('.projects-sidebar__item')?.click();
    }

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

  // Check if project description is empty (documenting)
  if (descriptions.length === 0) {
    container.innerHTML = `
      <div class="projects-detail__content">
        <div class="projects-detail__header">
          <div class="projects-detail__title-row">
            <h1>${p.title}</h1>
          </div>
          <div class="projects-detail__separator"></div>
        </div>
        <div class="projects-detail__wip">
          <div class="wip-animation wip-animation--docs">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h2>Documentation Coming Soon</h2>
          <p>This project is finished. Documentation is being prepared!</p>
        </div>
      </div>`;
    return;
  }

  // Check if project is "working" (still being designed)
  if (descriptions.length === 1 && descriptions[0].toLowerCase() === 'working') {
    container.innerHTML = `
      <div class="projects-detail__content">
        <div class="projects-detail__header">
          <div class="projects-detail__title-row">
            <h1>${p.title}</h1>
          </div>
          <div class="projects-detail__separator"></div>
        </div>
        <div class="projects-detail__wip">
          <div class="wip-animation wip-animation--design">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z"/>
            </svg>
          </div>
          <h2>Currently Being Designed</h2>
          <p>This project is still in the design phase. Stay tuned!</p>
        </div>
      </div>`;
    return;
  }
  const specs = p.specs ? p.specs.replace(/\\n/g, '\n').split('\n').map(s => s.trim()).filter(Boolean) : [];

  // Format text: **bold**, __underline__
  function fmt(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<u>$1</u>');
  }

  // Render descriptions - [img] full width, [imgr] right float, [imgl] left float, - bullets, rest paragraphs
  let descHTML = '';
  let inList = false;
  let hasFloat = false;
  descriptions.forEach(d => {
    if (d.startsWith('[img]')) {
      if (inList) { descHTML += '</ul>'; inList = false; }
      if (hasFloat) { descHTML += '<div class="clear"></div>'; hasFloat = false; }
      const filename = d.replace('[img]', '').trim();
      const src = filename.startsWith('http') ? filename : `images/projects/${filename}`;
      descHTML += `<div class="projects-detail__inline-img"><img src="${src}" alt="" onerror="this.parentElement.style.display='none'"></div>`;
    } else if (d.startsWith('[imgr]')) {
      if (inList) { descHTML += '</ul>'; inList = false; }
      if (hasFloat) { descHTML += '<div class="clear"></div>'; }
      const filename = d.replace('[imgr]', '').trim();
      const src = filename.startsWith('http') ? filename : `images/projects/${filename}`;
      descHTML += `<div class="projects-detail__inline-img projects-detail__inline-img--right"><img src="${src}" alt="" onerror="this.parentElement.style.display='none'"></div>`;
      hasFloat = true;
    } else if (d.startsWith('[imgl]')) {
      if (inList) { descHTML += '</ul>'; inList = false; }
      if (hasFloat) { descHTML += '<div class="clear"></div>'; }
      const filename = d.replace('[imgl]', '').trim();
      const src = filename.startsWith('http') ? filename : `images/projects/${filename}`;
      descHTML += `<div class="projects-detail__inline-img projects-detail__inline-img--left"><img src="${src}" alt="" onerror="this.parentElement.style.display='none'"></div>`;
      hasFloat = true;
    } else if (d.startsWith('- ')) {
      if (!inList) { descHTML += '<ul>'; inList = true; }
      descHTML += `<li>${fmt(d.substring(2))}</li>`;
    } else {
      if (inList) { descHTML += '</ul>'; inList = false; }
      descHTML += `<p>${fmt(d)}</p>`;
    }
  });
  if (inList) descHTML += '</ul>';
  if (hasFloat) descHTML += '<div class="clear"></div>';

  // Render specs as sections with text + image side by side
  let specsHTML = '';
  if (specs.length) {
    // Split specs into sections by [---]
    const sections = [];
    let currentSection = [];
    specs.forEach(line => {
      if (line === '[---]') {
        if (currentSection.length) sections.push(currentSection);
        currentSection = [];
      } else {
        currentSection.push(line);
      }
    });
    if (currentSection.length) sections.push(currentSection);

    const sectionsHTML = sections.map(section => {
      let textLines = [];
      let image = null;
      let imagePos = 'right'; // default

      section.forEach(line => {
        if (line.startsWith('[imgr]')) {
          image = line.replace('[imgr]', '').trim();
          imagePos = 'right';
        } else if (line.startsWith('[imgl]')) {
          image = line.replace('[imgl]', '').trim();
          imagePos = 'left';
        } else if (line.startsWith('[imgt]')) {
          image = line.replace('[imgt]', '').trim();
          imagePos = 'top';
        } else if (line.startsWith('[img]')) {
          image = line.replace('[img]', '').trim();
          imagePos = 'bottom';
        } else {
          textLines.push(line);
        }
      });

      // Render text content
      let textHTML = '';
      let inL = false;
      textLines.forEach(t => {
        if (t.startsWith('- ')) {
          if (!inL) { textHTML += '<ul>'; inL = true; }
          textHTML += `<li>${fmt(t.substring(2))}</li>`;
        } else {
          if (inL) { textHTML += '</ul>'; inL = false; }
          textHTML += `<p>${fmt(t)}</p>`;
        }
      });
      if (inL) textHTML += '</ul>';

      const imgSrc = image ? (image.startsWith('http') ? image : `images/projects/${image}`) : '';
      const imgTag = image ? `<div class="spec-section__img"><img src="${imgSrc}" alt="" onerror="this.parentElement.style.display='none'"></div>` : '';

      if (!image) {
        return `<div class="spec-section"><div class="spec-section__text">${textHTML}</div></div>`;
      } else if (imagePos === 'top') {
        return `<div class="spec-section spec-section--vertical">${imgTag}<div class="spec-section__text">${textHTML}</div></div>`;
      } else if (imagePos === 'bottom') {
        return `<div class="spec-section spec-section--vertical"><div class="spec-section__text">${textHTML}</div>${imgTag}</div>`;
      } else if (imagePos === 'left') {
        return `<div class="spec-section spec-section--row">${imgTag}<div class="spec-section__text">${textHTML}</div></div>`;
      } else {
        return `<div class="spec-section spec-section--row"><div class="spec-section__text">${textHTML}</div>${imgTag}</div>`;
      }
    }).join('');

    specsHTML = `
      <div class="projects-detail__specs">
        <h2>Specifications</h2>
        ${sectionsHTML}
      </div>`;
  }

  container.innerHTML = `
    <div class="projects-detail__content">
      <div class="projects-detail__header">
        <div class="projects-detail__title-row">
          <h1>${p.title}</h1>
          <div class="projects-detail__buttons">
            ${p.cadFile ? `<button class="btn btn--outline" id="cadBtn-${Date.now()}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:0.4rem;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>View CAD</button>` : ''}
            ${p.youtube ? `<button class="btn btn--outline" id="ytBtn-${Date.now()}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:0.4rem;"><path d="M23 9.71a8.5 8.5 0 0 0-.91-4.13 2.92 2.92 0 0 0-1.72-1.12A48.8 48.8 0 0 0 12 4a48.8 48.8 0 0 0-8.37.46 2.92 2.92 0 0 0-1.72 1.12A8.5 8.5 0 0 0 1 9.71a57.3 57.3 0 0 0 0 4.58 8.5 8.5 0 0 0 .91 4.13 2.92 2.92 0 0 0 1.72 1.12A48.8 48.8 0 0 0 12 20a48.8 48.8 0 0 0 8.37-.46 2.92 2.92 0 0 0 1.72-1.12 8.5 8.5 0 0 0 .91-4.13 57.3 57.3 0 0 0 0-4.58zM9.74 14.85V9.15l5.02 2.85-5.02 2.85z"/></svg>Watch Video</button>` : ''}
          </div>
        </div>
        <div class="projects-detail__separator"></div>
      </div>
      <div class="projects-detail__body">
        <div class="projects-detail__body-text">
          <div class="projects-detail__desc">
            ${descHTML}
          </div>
          ${projectToolsHTML(tools)}
        </div>
        ${p.banner ? `<div class="projects-detail__body-image">
          <img src="images/projects/${p.banner}" alt="${p.title}" onerror="this.style.display='none'">
        </div>` : ''}
      </div>
      ${specsHTML}
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

  // Attach YouTube button event listener
  if (p.youtube) {
    const ytBtn = container.querySelector('[id^="ytBtn-"]');
    if (ytBtn) {
      ytBtn.addEventListener('click', () => {
        openYoutubeModal(p.youtube);
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.projects-page')) loadProjects();
});

function toggleTopicGroup(btn) {
  const group = btn.parentElement;
  const isCollapsed = group.classList.contains('collapsed');
  
  // If under 1000px, close all others first
  if (window.innerWidth < 1000) {
    document.querySelectorAll('.projects-sidebar__group').forEach(g => {
      g.classList.add('collapsed');
    });
  }
  
  // Toggle the clicked one
  if (isCollapsed) {
    group.classList.remove('collapsed');
  } else {
    group.classList.add('collapsed');
  }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (window.innerWidth >= 1000) return;
  if (!e.target.closest('.projects-sidebar__group')) {
    document.querySelectorAll('.projects-sidebar__group').forEach(g => {
      g.classList.add('collapsed');
    });
  }
});
