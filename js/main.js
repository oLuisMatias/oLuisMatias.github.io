document.addEventListener('DOMContentLoaded', () => {
  // ── Theme toggle ──────────────────────────────────
  const root = document.documentElement;
  const btn  = document.getElementById('themeToggle');

  const saved = localStorage.getItem('theme') || 'dark';
  root.setAttribute('data-theme', saved);
  const iconSun  = document.getElementById('iconSun');
  const iconMoon = document.getElementById('iconMoon');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    iconSun.style.display  = theme === 'dark'  ? 'block' : 'none';
    iconMoon.style.display = theme === 'light' ? 'block' : 'none';
    localStorage.setItem('theme', theme);
  }

  applyTheme(saved);

  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  // ── CV section toggles ────────────────────────────
  document.querySelectorAll('.cv__toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const body = btn.closest('.cv__section').querySelector('.cv__body');
      const open = body.classList.toggle('open');
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open);
      btn.textContent = open ? '−' : '+';
    });
  });
  // ── Typewriter ────────────────────────────────────
  const el = document.getElementById('typewriter');
  if (el) {
    const text = "Hello, I'm Luis Matias";
    let i = 0;

    function type() {
      if (i < text.length) {
        el.textContent += text[i++];
        setTimeout(type, 60);
      } else {
        el.classList.remove('typing');
      }
    }

    el.classList.add('typing');
    type();
  }
});
