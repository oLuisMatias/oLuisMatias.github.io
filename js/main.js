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

  // ── Burger menu toggle ────────────────────────────
  const burger = document.getElementById('burgerMenu');
  const navLinks = document.querySelector('.navbar__links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('active');
      navLinks.classList.toggle('open');
    });
    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('active');
        navLinks.classList.remove('open');
      });
    });
  }

  // ── Close info tooltips on outside click ──────────
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cv-info-btn')) {
      document.querySelectorAll('.cv-info-tooltip.show').forEach(t => t.classList.remove('show'));
    }
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

// Show info tooltip at click position
function showInfoTooltip(e, tooltip) {
  e.stopPropagation();
  const isShowing = tooltip.classList.contains('show');
  document.querySelectorAll('.cv-info-tooltip.show').forEach(t => t.classList.remove('show'));
  if (!isShowing) {
    if (window.innerWidth < 1000) {
      // Small screen: top-right corner at click position (tooltip goes left)
      tooltip.style.left = 'auto';
      tooltip.style.right = (window.innerWidth - e.clientX) + 'px';
      tooltip.style.top = e.clientY + 'px';
    } else {
      // Desktop: top-left corner at click position (tooltip goes right)
      tooltip.style.left = e.clientX + 'px';
      tooltip.style.right = 'auto';
      tooltip.style.top = e.clientY + 'px';
    }
    tooltip.classList.add('show');
  }
}

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
  const theme = root.getAttribute('data-theme') || 'dark';

  // Only apply settings that don't start with _ (those are saved/notes)
  if (settings.accent_color) {
    root.style.setProperty('--accent', settings.accent_color);
  }
  // Only apply bg/text overrides in dark mode to avoid breaking light theme
  if (theme === 'dark') {
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
}
