// Map View functionality for CV page
class MapView {
    constructor() {
        this.isMapView = false;
        this.mapContainer = null;
        this.listContainer = null;
        this.toggleBtn = null;
        this.locations = [];
        
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
            'SK': 'Slovakia'
        };
        
        // Approximate coordinates for countries (you can adjust these)
        this.countryCoordinates = {
            'PT': { x: 44.6, y: 47.6 }, // Portugal
            'TH': { x: 71.4, y: 60.1 }, // Thailand
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
            'PL': { x: 54, y: 36 }, // Poland
            'CZ': { x: 53, y: 38 }, // Czech Republic
            'SK': { x: 54, y: 39 }  // Slovakia
        };
    }
    
    init() {
        this.toggleBtn = document.getElementById('mapViewToggle');
        this.listContainer = document.querySelector('.page-content .container');
        
        if (!this.toggleBtn || !this.listContainer) return;
        
        this.toggleBtn.addEventListener('click', () => this.toggleView());
    }
    
    toggleView() {
        this.isMapView = !this.isMapView;
        
        if (this.isMapView) {
            this.showMapView();
        } else {
            this.showListView();
        }
    }
    
    showMapView() {
        // Hide list view
        this.listContainer.style.display = 'none';
        
        // Add map view class to body
        document.body.classList.add('map-view-active');
        
        // Update button
        this.toggleBtn.innerHTML = '<i class="fas fa-list"></i> List View';
        
        // Create or show map container
        if (!this.mapContainer) {
            this.createMapView();
        } else {
            this.mapContainer.classList.add('active');
        }
    }
    
    showListView() {
        // Show list view
        this.listContainer.style.display = 'block';
        
        // Remove map view class from body
        document.body.classList.remove('map-view-active');
        
        // Update button
        this.toggleBtn.innerHTML = '<i class="fas fa-map-marked-alt"></i> Map View';
        
        // Hide map container
        if (this.mapContainer) {
            this.mapContainer.classList.remove('active');
        }
    }
    
    createMapView() {
        const pageContent = document.querySelector('.page-content');
        
        this.mapContainer = document.createElement('div');
        this.mapContainer.className = 'map-view-container active';
        this.mapContainer.innerHTML = `
            <div class="map-content-wrapper">
                <div class="map-wrapper" id="mapWrapper">
                    <img src="assets/images/worldmap/worldmap.png" alt="World Map" class="map-image">
                    <div id="mapTooltip" class="map-tooltip"></div>
                </div>
                <div class="map-details-panel" id="mapDetailsPanel">
                    <div class="map-details-content">
                        <p style="text-align: center; color: var(--text-light); opacity: 0.7;">Click on a marker to see details</p>
                    </div>
                </div>
            </div>
            <div class="map-legend">
                <div class="legend-item">
                    <div class="legend-dot work"></div>
                    <span>Locations (click for details)</span>
                </div>
            </div>
        `;
        
        pageContent.insertBefore(this.mapContainer, this.listContainer);
        
        // Wait for CV data to load, then add markers
        setTimeout(() => this.addMarkers(), 1000);
    }
    
    addMarkers() {
        // Get data from DataLoader (assuming it's already loaded)
        const cvData = window.cvData;
        if (!cvData) {
            console.log('Waiting for CV data...');
            setTimeout(() => this.addMarkers(), 500);
            return;
        }
        
        const mapWrapper = document.getElementById('mapWrapper');
        const tooltip = document.getElementById('mapTooltip');
        
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
        Object.keys(groupedByCountry).forEach(countryCode => {
            this.createGroupedMarker(mapWrapper, tooltip, countryCode, groupedByCountry[countryCode]);
        });
    }
    
    createGroupedMarker(mapWrapper, tooltip, countryCode, entries) {
        const coords = this.countryCoordinates[countryCode];
        if (!coords) {
            console.log('No coordinates for:', countryCode);
            return;
        }
        
        // All markers are blue
        const marker = document.createElement('div');
        marker.className = 'map-marker work';
        marker.style.left = `${coords.x}%`;
        marker.style.top = `${coords.y}%`;
        
        // Add count badge if multiple entries
        if (entries.length > 1) {
            const badge = document.createElement('span');
            badge.style.cssText = `
                position: absolute;
                top: -8px;
                right: -8px;
                background: white;
                color: #333;
                border-radius: 50%;
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                border: 2px solid var(--primary-blue);
            `;
            badge.textContent = entries.length;
            marker.appendChild(badge);
        }
        
        marker.addEventListener('mouseenter', (e) => {
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
        
        mapWrapper.appendChild(marker);
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('curriculum.html')) {
        const mapView = new MapView();
        mapView.init();
        
        // Store reference for DataLoader
        window.mapView = mapView;
    }
});
