// ===================================
// THEME MANAGEMENT
// ===================================

function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    
    if (!themeToggle || !themeIcon) return;
    
    // Get saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme, themeIcon);
    
    // Theme toggle click handler
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme, themeIcon);
    });
}

function updateThemeIcon(theme, iconElement) {
    const isLight = theme === 'light';
    iconElement.className = isLight ? 'fas fa-moon' : 'fas fa-sun';
    iconElement.parentElement.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
}

// ===================================
// MOBILE MENU
// ===================================

function initializeMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const navLinks = document.getElementById('navLinks');

    if (!mobileMenuToggle || !navLinks) return;

    // Toggle menu
    mobileMenuToggle.addEventListener('click', () => {
        mobileMenuToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    // Close menu when clicking on a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuToggle.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!mobileMenuToggle.contains(e.target) && !navLinks.contains(e.target)) {
            mobileMenuToggle.classList.remove('active');
            navLinks.classList.remove('active');
        }
    });
}

// ===================================
// SMOOTH SCROLLING & HEADER EFFECTS
// ===================================

function initializeSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function initializeHeaderScroll() {
    let ticking = false;
    const header = document.querySelector('header');
    
    if (!header) return;

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                header.style.boxShadow = window.scrollY > 50 
                    ? '0 2px 20px rgba(0,0,0,0.15)' 
                    : '0 2px 10px rgba(0,0,0,0.1)';
                ticking = false;
            });
            ticking = true;
        }
    });
}

// ===================================
// CONTACT FORM
// ===================================

function initializeContactForm() {
    const contactForm = document.querySelector('.contact-form');
    
    if (!contactForm) return;

    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = contactForm.querySelector('input[type="text"]')?.value;
        const email = contactForm.querySelector('input[type="email"]')?.value;
        const message = contactForm.querySelector('textarea')?.value;
        
        if (!name || !email || !message) {
            alert('Please fill in all fields');
            return;
        }
        
        alert('Thank you for your message!');
        contactForm.reset();
    });
}

// ===================================
// TYPEWRITER ANIMATION
// ===================================

function initializeTypewriter() {
    const heroTitle = document.querySelector('.hero-content h2');
    
    if (!heroTitle) return;

    const text = "Hello, I'm Luis Matias";
    heroTitle.textContent = '';
    heroTitle.style.minHeight = '1.2em'; // Prevent layout shift
    
    let i = 0;
    const typeWriter = () => {
        if (i < text.length) {
            heroTitle.textContent += text.charAt(i);
            i++;
            setTimeout(typeWriter, 100);
        }
    };
    
    // Start typing after a short delay
    setTimeout(typeWriter, 800);
}

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    // Hide loading screen
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
    
    // Initialize all features
    initializeTheme();
    initializeMobileMenu();
    initializeSmoothScrolling();
    initializeHeaderScroll();
    initializeContactForm();
    initializeTypewriter();
});