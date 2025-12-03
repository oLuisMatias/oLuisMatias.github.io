// ===================================
// MAP VITAE - Dedicated Map Page
// ===================================

class MapVitae {
    constructor() {
        this.locations = [];
        this.debugMode = false; // Set to true to get coordinates when clicking map
        
        // Country names
        this.countryNames = {
            'PT': 'Portugal',
            'ES': 'Spain',
            'FR': 'France',
            'DE': 'Germany',
            'UK': 'United Kingdom',
            'GB': 'United Kingdom',
            'IT': 'Italy',
            'US': 'United States',
            'CA': 'Canada',
            'BR': 'Brazil',
            'CN': 'China',
            'JP': 'Japan',
            'AU': 'Australia',
            'IN': 'India',
            'ZA': 'South Africa',
            'MX': 'Mexico',
            'AR': 'Argentina',
            'RU': 'Russia',
            'SE': 'Sweden',
            'NO': 'Norway',
            'DK': 'Denmark',
            'NL': 'Netherlands',
            'BE': 'Belgium',
            'CH': 'Switzerland',
            'AT': 'Austria',
            'PL': 'Poland',
            'CZ': 'Czech Republic',
            'SK': 'Slovakia',
            'TH': 'Thailand'
        };
        
        // Coordinates for countries
        this.countryCoordinates = {
            'PT': { x: 42, y: 29.8 }, // Portugal
            'TH': { x: 77, y: 47.6 }, // Thailand
            'PL': { x: 48.6, y: 20.4 }, // Poland
            'SK': { x: 48.6, y: 26.5 }, // Slovakia
            'ES': { x: 49, y: 42 }, // Spain
            'FR': { x: 50, y: 40 }, // France
            'DE': { x: 52, y: 38 }, // Germany
            'UK': { x: 49, y: 37 }, // United Kingdom
            'GB': { x: 49, y: 37 }, // Great Britain
            'IT': { x: 53, y: 43 }, // Italy
            'US': { x: 25, y: 42 }, // United States
            'CA': { x: 22, y: 35 }, // Canada
            'BR': { x: 35, y: 60 }, // Brazil
            'CN': { x: 75, y: 42 }, // China
            'JP': { x: 82, y: 42 }, // Japan
            'AU': { x: 80, y: 70 }, // Australia
            'IN': { x: 70, y: 48 }, // India
            'ZA': { x: 55, y: 70 }, // South Africa
            'MX': { x: 20, y: 48 }, // Mexico
            'AR': { x: 35, y: 75 }, // Argentina
            'RU': { x: 65, y: 35 }, // Russia
            'SE': { x: 53, y: 32 }, // Sweden
            'NO': { x: 52, y: 30 }, // Norway
            'DK': { x: 52, y: 35 }, // Denmark
            'NL': { x: 51, y: 37 }, // Netherlands
            'BE': { x: 51, y: 38 }, // Belgium
            'CH': { x: 52, y: 40 }, // Switzerland
            'AT': { x: 53, y: 39 }, // Austria
            'CZ': { x: 53, y: 38 }  // Czech Republic
        };
    }
    
    init() {
        // Show loading message
        this.showLoading();
        
        // Check for CV data immediately and repeatedly
        this.loadMapData();
        
        // Enable debug mode if needed
        if (this.debugMode) {
            this.enableDebugMode();
        }
    }
    
    showLoading() {
        const panel = document.getElementById('mapDetailsPanel');
        if (panel) {
            const content = panel.querySelector('.map-details-content');
            content.innerHTML = '<p style="text-align: center; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> Loading map data...</p>';
        }
    }
    
    enableDebugMode() {
        const mapContainer = document.querySelector('.map-image-container');
        const mapImage = document.getElementById('mapImage');
        
        if (!mapImage || !mapContainer) return;
        
        mapImage.addEventListener('click', (e) => {
            const rect = mapImage.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
            const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
            
            console.log(`Clicked coordinates: { x: ${x}, y: ${y} }`);
            
            // Show temporary marker at clicked position
            const debugMarker = document.createElement('div');
            debugMarker.className = 'map-marker work';
            debugMarker.style.left = `${x}%`;
            debugMarker.style.top = `${y}%`;
            debugMarker.style.background = 'red';
            debugMarker.innerHTML = `<span style="position: absolute; top: 25px; left: -20px; background: black; color: white; padding: 2px 5px; font-size: 10px; white-space: nowrap;">${x}, ${y}</span>`;
            mapContainer.appendChild(debugMarker);
            
            // Remove after 3 seconds
            setTimeout(() => debugMarker.remove(), 3000);
        });
    }
    
    loadMapData() {
        // Get data from DataLoader (assuming it's already loaded)
        const cvData = window.cvData;
        if (!cvData) {
            console.log('MapVitae: Waiting for CV data...');
            setTimeout(() => this.loadMapData(), 200);
            return;
        }
        
        console.log('MapVitae: CV data loaded, creating markers...');
        
        // Update loading message
        const panel = document.getElementById('mapDetailsPanel');
        if (panel) {
            const content = panel.querySelector('.map-details-content');
            content.innerHTML = '<p style="text-align: center; color: var(--text-light); opacity: 0.7;">Click on a flag to see details</p>';
        }
        
        const mapContainer = document.querySelector('.map-image-container');
        const tooltip = document.getElementById('mapTooltip');
        
        if (!mapContainer) {
            console.error('MapVitae: Map container not found!');
            return;
        }
        
        console.log('MapVitae: Map container found:', mapContainer);
        
        // Group all entries by country code
        const groupedByCountry = {};
        
        // Collect work experience
        if (cvData.workExperience) {
            cvData.workExperience.forEach(job => {
                if (job.countryCode) {
                    const code = job.countryCode.toUpperCase();
                    if (!groupedByCountry[code]) {
                        groupedByCountry[code] = [];
                    }
                    groupedByCountry[code].push({
                        type: 'work',
                        title: job.title,
                        organization: job.company,
                        location: job.location,
                        period: job.period
                    });
                }
            });
        }
        
        // Collect education
        if (cvData.education) {
            cvData.education.forEach(edu => {
                if (edu.countryCode) {
                    const code = edu.countryCode.toUpperCase();
                    if (!groupedByCountry[code]) {
                        groupedByCountry[code] = [];
                    }
                    groupedByCountry[code].push({
                        type: 'education',
                        title: edu.degree,
                        organization: edu.institution,
                        location: edu.location,
                        period: edu.period
                    });
                }
            });
        }
        
        // Collect experiences
        if (cvData.experiences) {
            cvData.experiences.forEach(exp => {
                if (exp.countryCode) {
                    const code = exp.countryCode.toUpperCase();
                    if (!groupedByCountry[code]) {
                        groupedByCountry[code] = [];
                    }
                    groupedByCountry[code].push({
                        type: 'experience',
                        title: exp.title,
                        organization: exp.organization,
                        location: exp.location,
                        period: exp.period
                    });
                }
            });
        }
        
        // Create one marker per country with all entries
        console.log('MapVitae: Countries found:', Object.keys(groupedByCountry));
        
        // Sort countries so Slovakia renders after Poland (appears on top)
        const sortedCountries = Object.keys(groupedByCountry).sort((a, b) => {
            if (a === 'PL') return -1; // Poland first
            if (b === 'PL') return 1;
            if (a === 'SK') return 1; // Slovakia after Poland
            if (b === 'SK') return -1;
            return 0;
        });
        
        sortedCountries.forEach(countryCode => {
            this.createMarker(mapContainer, tooltip, countryCode, groupedByCountry[countryCode]);
        });
        console.log('MapVitae: Markers created successfully');
    }
    
    createMarker(mapContainer, tooltip, countryCode, entries) {
        const coords = this.countryCoordinates[countryCode];
        if (!coords) {
            console.log('No coordinates for:', countryCode);
            return;
        }
        
        // Create marker with flag
        const marker = document.createElement('div');
        marker.className = 'map-marker flag-marker';
        marker.style.left = `${coords.x}%`;
        marker.style.top = `${coords.y}%`;
        
        // Add flag image using flagcdn.com (smaller size)
        const flagImg = document.createElement('img');
        flagImg.src = `https://flagcdn.com/24x18/${countryCode.toLowerCase()}.png`;
        flagImg.alt = countryCode;
        flagImg.style.cssText = 'width: 24px; height: 18px; border-radius: 2px; box-shadow: 0 2px 6px rgba(0,0,0,0.3);';
        marker.appendChild(flagImg);
        
        // Add count badge if multiple entries
        if (entries.length > 1) {
            const badge = document.createElement('span');
            badge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: var(--primary-blue);
                color: white;
                border-radius: 50%;
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 9px;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            `;
            badge.textContent = entries.length;
            marker.appendChild(badge);
        }
        
        marker.addEventListener('mouseenter', () => {
            const countryName = this.countryNames[countryCode] || countryCode;
            tooltip.innerHTML = `<strong>${countryName}</strong><br><small>Click for details</small>`;
            tooltip.style.left = `${coords.x}%`;
            tooltip.style.top = `${coords.y - 5}%`;
            tooltip.classList.add('active');
        });
        
        marker.addEventListener('mouseleave', () => {
            tooltip.classList.remove('active');
        });
        
        marker.addEventListener('click', () => {
            this.showDetailsPanel(entries, countryCode);
        });
        
        mapContainer.appendChild(marker);
    }
    
    showDetailsPanel(entries, countryCode) {
        const panel = document.getElementById('mapDetailsPanel');
        const content = panel.querySelector('.map-details-content');
        
        // Group entries by type
        const work = entries.filter(e => e.type === 'work');
        const education = entries.filter(e => e.type === 'education');
        const experiences = entries.filter(e => e.type === 'experience');
        
        const countryName = this.countryNames[countryCode] || countryCode;
        let detailsHTML = `<h3 style="margin-bottom: 1.5rem;">${countryName}</h3>`;
        
        // Add work section
        if (work.length > 0) {
            detailsHTML += '<div style="margin-bottom: 1.5rem;"><h4 style="color: #3498db; margin-bottom: 0.75rem;">Work Experience</h4>';
            work.forEach(entry => {
                detailsHTML += `
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--medium-charcoal); border-radius: 6px;">
                        <strong>${entry.organization}</strong><br>
                        <span style="color: var(--text-light);">${entry.title}</span><br>
                        <small style="opacity: 0.7;">${entry.period}</small>
                    </div>
                `;
            });
            detailsHTML += '</div>';
        }
        
        // Add education section
        if (education.length > 0) {
            detailsHTML += '<div style="margin-bottom: 1.5rem;"><h4 style="color: #9b59b6; margin-bottom: 0.75rem;">Education</h4>';
            education.forEach(entry => {
                detailsHTML += `
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--medium-charcoal); border-radius: 6px;">
                        <strong>${entry.organization}</strong><br>
                        <span style="color: var(--text-light);">${entry.title}</span><br>
                        <small style="opacity: 0.7;">${entry.period}</small>
                    </div>
                `;
            });
            detailsHTML += '</div>';
        }
        
        // Add experiences section
        if (experiences.length > 0) {
            detailsHTML += '<div style="margin-bottom: 1.5rem;"><h4 style="color: #e74c3c; margin-bottom: 0.75rem;">Experiences</h4>';
            experiences.forEach(entry => {
                detailsHTML += `
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--medium-charcoal); border-radius: 6px;">
                        <strong>${entry.organization}</strong><br>
                        <span style="color: var(--text-light);">${entry.title}</span><br>
                        <small style="opacity: 0.7;">${entry.period}</small>
                    </div>
                `;
            });
            detailsHTML += '</div>';
        }
        
        content.innerHTML = detailsHTML;
    }
}

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('map-vitae.html')) {
        const mapVitae = new MapVitae();
        mapVitae.init();
    }
});
