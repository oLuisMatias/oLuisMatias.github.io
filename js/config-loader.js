// ===================================
// SITE CONFIGURATION LOADER
// ===================================

class SiteConfig {
    static async loadConfig() {
        try {
            const response = await fetch('data/site-config.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const config = await response.json();
            
            this.applyConfig(config);
            return config;
        } catch (error) {
            console.error('Error loading site configuration:', error);
            return null;
        }
    }
    
    static applyConfig(config) {
        // Update social media links
        this.updateSocialLinks(config.socialMedia);
        
        // Update personal info
        this.updatePersonalInfo(config.personalInfo);
        
        // Apply theme settings (but not colors)
        this.applyThemeSettings(config.theme);
    }
    
    static updateSocialLinks(socialMedia) {
        if (!socialMedia) return;
        
        // Update LinkedIn links
        if (socialMedia.linkedin?.url) {
            document.querySelectorAll('a[href*="linkedin.com"]').forEach(link => {
                link.href = socialMedia.linkedin.url;
            });
        }
        
        // Update Instagram links
        if (socialMedia.instagram?.url) {
            document.querySelectorAll('a[href*="instagram.com"]').forEach(link => {
                link.href = socialMedia.instagram.url;
            });
        }
    }
    
    static updatePersonalInfo(personalInfo) {
        if (!personalInfo) return;
        
        // Update logo/header name
        if (personalInfo.firstName && personalInfo.lastName) {
            document.querySelectorAll('.logo h1').forEach(logo => {
                logo.innerHTML = `${personalInfo.firstName}<span class="highlight">${personalInfo.lastName}</span>`;
            });
        }
        
        // Update hero image if on homepage
        const profileImage = document.querySelector('.profile-photo');
        if (profileImage && personalInfo.profileImage) {
            profileImage.src = personalInfo.profileImage;
            profileImage.alt = personalInfo.name || 'Profile Photo';
        }
        
        // Update page titles
        if (personalInfo.name) {
            document.querySelectorAll('title').forEach(title => {
                if (title.textContent.includes('Luis Matias')) {
                    title.textContent = title.textContent.replace('Luis Matias', personalInfo.name);
                }
            });
        }
        
        // Update hero subtitle if on homepage
        const heroSubtitle = document.querySelector('.hero-content p');
        if (heroSubtitle && personalInfo.subtitle) {
            heroSubtitle.textContent = personalInfo.subtitle;
        }
        
        // Update copyright (preserve HTML links)
        if (personalInfo.name) {
            document.querySelectorAll('footer p').forEach(copyright => {
                if (copyright.innerHTML.includes('Luis Matias')) {
                    copyright.innerHTML = copyright.innerHTML.replace('Luis Matias', personalInfo.name);
                }
            });
        }
    }
    
    static applyThemeSettings(themeSettings) {
        if (!themeSettings) return;
        
        // Set default theme
        if (!localStorage.getItem('theme') && themeSettings.default) {
            localStorage.setItem('theme', themeSettings.default);
            document.documentElement.setAttribute('data-theme', themeSettings.default);
        }
        
        // Hide theme toggle if disabled
        if (themeSettings.enableToggle === false) {
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.style.display = 'none';
            }
        }
    }
    
    static checkPageAvailability(config) {
        if (!config?.pages) return;
        
        const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
        
        // Check if we're on a page that might be disabled
        if (config.pages.hasOwnProperty(currentPage)) {
            const isEnabled = config.pages[currentPage];
            
            // If page is disabled, redirect to coming soon
            if (!isEnabled && !window.location.pathname.includes('coming-soon.html')) {
                window.location.href = 'coming-soon.html';
            }
        }
    }
}

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    SiteConfig.loadConfig().then(config => {
        if (config) {
            SiteConfig.checkPageAvailability(config);
        }
    });
});