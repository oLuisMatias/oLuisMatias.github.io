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

  // ── Load site settings from Google Sheet ──────────
  loadSiteSettings();

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

// ── Site Settings Loader ────────────────────────────
const SETTINGS_SHEET_ID = '1gT2fLInodV6ohZQd4eBoyqGWmZG0vK31Yp3UFJ_XkUQ';
const SETTINGS_GID = 1529716779;

async function loadSiteSettings() {
  try {
    // Apply cached settings immediately to prevent flash
    const cached = localStorage.getItem('siteSettings');
    if (cached) {
      applySettings(JSON.parse(cached));
    }

    const url = `https://docs.google.com/spreadsheets/d/${SETTINGS_SHEET_ID}/export?format=csv&gid=${SETTINGS_GID}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const csv = await res.text();
    const settings = parseSettingsCSV(csv);
    
    // Cache for next load
    localStorage.setItem('siteSettings', JSON.stringify(settings));
    applySettings(settings);
  } catch (e) {
    console.error('Settings load error:', e);
  }
}

function parseSettingsCSV(csv) {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return {};
  const settings = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const key = parts[0] ? parts[0].trim().replace(/"/g, '') : '';
    const value = parts.slice(1).join(',').trim().replace(/"/g, '');
    // Skip empty keys and keys starting with _ (saved colors/notes)
    if (key && !key.startsWith('_')) settings[key] = value;
  }
  return settings;
}

function applySettings(settings) {
  const root = document.documentElement;

  // Only apply settings that don't start with _ (those are saved/notes)
  if (settings.accent_color) {
    root.style.setProperty('--accent', settings.accent_color);
  }
  if (settings.bg_dark) {
    root.style.setProperty('--bg', settings.bg_dark);
  }
  if (settings.bg_surface_dark) {
    root.style.setProperty('--bg-surface', settings.bg_surface_dark);
  }
  if (settings.text_color) {
    root.style.setProperty('--text', settings.text_color);
  }
}
