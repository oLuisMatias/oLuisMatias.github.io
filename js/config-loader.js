// Site Configuration Loader
class SiteConfig {
    
    static async loadConfig() {
        try {
            const response = await fetch('data/site-config.json');
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
        // Update LinkedIn links
        const linkedinLinks = document.querySelectorAll('a[href*="linkedin.com"]');
        linkedinLinks.forEach(link => {
            link.href = socialMedia.linkedin.url;
        });
        
        // Update Instagram links
        const instagramLinks = document.querySelectorAll('a[href*="instagram.com"]');
        instagramLinks.forEach(link => {
            link.href = socialMedia.instagram.url;
        });
    }
    
    static updatePersonalInfo(personalInfo) {
        // Update logo/header name
        const logoElements = document.querySelectorAll('.logo h1');
        logoElements.forEach(logo => {
            logo.innerHTML = `${personalInfo.firstName}<span class="highlight">${personalInfo.lastName}</span>`;
        });
        
        // Update hero image if on homepage
        const profileImage = document.querySelector('.profile-photo');
        if (profileImage) {
            profileImage.src = personalInfo.profileImage;
            profileImage.alt = personalInfo.name;
        }
        
        // Update page titles
        const titleElements = document.querySelectorAll('title');
        titleElements.forEach(title => {
            if (title.textContent.includes('Luis Matias')) {
                title.textContent = title.textContent.replace('Luis Matias', personalInfo.name);
            }
        });
        
        // Update hero subtitle if on homepage
        const heroSubtitle = document.querySelector('.hero-content p');
        if (heroSubtitle && heroSubtitle.textContent.includes('Mechanical Designer')) {
            heroSubtitle.textContent = personalInfo.subtitle;
        }
        
        // Update copyright
        const copyrightElements = document.querySelectorAll('footer p');
        copyrightElements.forEach(copyright => {
            if (copyright.textContent.includes('Luis Matias')) {
                copyright.textContent = copyright.textContent.replace('Luis Matias', personalInfo.name);
            }
        });
    }
    
    static applyThemeSettings(themeSettings) {
        // Set default theme
        if (!localStorage.getItem('theme')) {
            localStorage.setItem('theme', themeSettings.default);
            document.documentElement.setAttribute('data-theme', themeSettings.default);
        }
        
        // Hide theme toggle if disabled
        if (!themeSettings.enableToggle) {
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.style.display = 'none';
            }
        }
    }
}

// Load configuration when page loads
document.addEventListener('DOMContentLoaded', function() {
    SiteConfig.loadConfig().then(config => {
        if (config) {
            SiteConfig.checkPageAvailability(config);
        }
    });
});

// Check if current page should be available
SiteConfig.checkPageAvailability = function(config) {
    const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
    
    // Check if we're on a page that might be disabled
    if (config.pages && config.pages.hasOwnProperty(currentPage)) {
        const isEnabled = config.pages[currentPage];
        
        // If page is disabled, redirect to coming soon
        if (!isEnabled) {
            // Only redirect if we're not already on the coming soon page
            if (!window.location.pathname.includes('coming-soon.html')) {
                window.location.href = 'coming-soon.html';
            }
        }
    }
};