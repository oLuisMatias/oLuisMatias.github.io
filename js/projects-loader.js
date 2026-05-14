async function loadProjects() {
  const sidebar = document.getElementById('projectsSidebar');
  const detail  = document.getElementById('projectsDetail');
  if (!sidebar) return;

  try {
    const res  = await fetch('data/projects.json');
    const data = await res.json();

    if (!data.length) return;

    sidebar.innerHTML = data.map((p, i) => `
      <button class="projects-sidebar__item" data-index="${i}">
        <img src="images/projects/${p.image}" alt="${p.title}"
             onerror="this.style.display='none'">
        <span>${p.title}</span>
      </button>
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
  }
}

function renderDetail(container, p) {
  container.innerHTML = `
    <div class="projects-detail__content">
      <div class="projects-detail__image">
        <img src="images/projects/${p.image}" alt="${p.title}" onerror="this.style.display='none'">
      </div>
      <div class="projects-detail__info">
        <div class="projects-detail__title-row">
          <h1>${p.title}</h1>
          ${p.cadFile ? `<button class="btn btn--outline" onclick="openModel('${p.cadFile}')">View CAD File</button>` : ''}
        </div>
        ${p.role   ? `<p class="projects-detail__role">${p.role}</p>` : ''}
        ${p.period ? `<p class="projects-detail__period">${p.period}</p>` : ''}
        <div class="projects-detail__desc">
          ${p.descriptions.map(d => `<p>${d}</p>`).join('')}
        </div>
      </div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.projects-page')) loadProjects();
});
