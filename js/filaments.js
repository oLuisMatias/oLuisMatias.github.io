// Filaments Page JavaScript
class FilamentsManager {
    constructor() {
        this.filaments = [];
        this.filteredFilaments = [];
    }

    async loadFilaments() {
        try {
            // Google Sheets CSV export URL
            const sheetId = '1efb2bbUmlK1dC46ZWsYcVy1NgSGmpbAzgLxxNyIb92Q';
            const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
            
            // Fetch data from Google Sheets
            const response = await fetch(sheetUrl);
            const csvText = await response.text();
            
            // Parse CSV to JSON
            this.filaments = this.parseCSV(csvText);
            
            this.filteredFilaments = [...this.filaments];
            this.populateFilters();
            this.filterFilaments();
        } catch (error) {
            console.error('Error loading filaments:', error);
            alert('Error loading filaments from Google Sheets. Make sure the sheet is shared as "Anyone with the link can view"');
        }
    }
    
    parseCSV(csv) {
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            
            headers.forEach((header, index) => {
                if (header === 'owned') {
                    row[header] = values[index]?.toUpperCase() === 'TRUE';
                } else {
                    row[header] = values[index] || '';
                }
            });
            
            data.push(row);
        }
        
        return data;
    }

    renderFilaments() {
        const grid = document.getElementById('filamentsGrid');
        if (!grid) return;

        grid.innerHTML = this.filteredFilaments.map(filament => `
            <div class="filament-card ${filament.owned ? 'owned' : 'not-owned'}" data-brand="${filament.brand}" data-material="${filament.materialType}">
                <div class="filament-swatch" style="background-color: ${filament.hexColor};"></div>
                <div class="filament-info">
                    <div class="filament-brand">${filament.brand}</div>
                    <div class="filament-material-type">${filament.materialType}</div>
                    <div class="filament-color-name">${filament.colorName}</div>
                    <div class="filament-reference">${filament.reference}</div>
                </div>
            </div>
        `).join('');
    }

    populateFilters() {
        // Get unique brands
        const brands = [...new Set(this.filaments.map(f => f.brand))].sort();
        const brandFilter = document.getElementById('brandFilter');
        if (brandFilter) {
            brands.forEach(brand => {
                const option = document.createElement('option');
                option.value = brand;
                option.textContent = brand;
                brandFilter.appendChild(option);
            });
        }

        // Get unique material types
        const materials = [...new Set(this.filaments.map(f => f.materialType))].sort();
        const materialFilter = document.getElementById('colorFilter');
        if (materialFilter) {
            materials.forEach(material => {
                const option = document.createElement('option');
                option.value = material;
                option.textContent = material;
                materialFilter.appendChild(option);
            });
        }
    }

    filterFilaments() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const brandFilter = document.getElementById('brandFilter').value;
        const colorFilter = document.getElementById('colorFilter').value;
        const ownedOnly = document.getElementById('ownedFilter').checked;
        const showAll = document.getElementById('allFilter').checked;

        this.filteredFilaments = this.filaments.filter(filament => {
            const matchesSearch = filament.brand.toLowerCase().includes(searchTerm) ||
                                filament.colorName.toLowerCase().includes(searchTerm) ||
                                filament.materialType.toLowerCase().includes(searchTerm) ||
                                filament.colorGroup.toLowerCase().includes(searchTerm);
            const matchesBrand = !brandFilter || filament.brand === brandFilter;
            const matchesMaterial = !colorFilter || filament.materialType === colorFilter;
            
            // If "All" is checked, show everything. If "Owned" is checked, show only owned. If neither, show owned by default.
            const matchesOwned = showAll || (ownedOnly && filament.owned === true) || (!showAll && !ownedOnly && filament.owned === true);

            return matchesSearch && matchesBrand && matchesMaterial && matchesOwned;
        });

        this.renderFilaments();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const brandFilter = document.getElementById('brandFilter');
        const colorFilter = document.getElementById('colorFilter');
        const ownedFilter = document.getElementById('ownedFilter');
        const allFilter = document.getElementById('allFilter');

        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterFilaments());
        }

        if (brandFilter) {
            brandFilter.addEventListener('change', () => this.filterFilaments());
        }

        if (colorFilter) {
            colorFilter.addEventListener('change', () => this.filterFilaments());
        }

        if (ownedFilter) {
            ownedFilter.addEventListener('change', (e) => {
                if (e.target.checked && allFilter) {
                    allFilter.checked = false;
                }
                this.filterFilaments();
            });
        }

        if (allFilter) {
            allFilter.addEventListener('change', (e) => {
                if (e.target.checked && ownedFilter) {
                    ownedFilter.checked = false;
                }
                this.filterFilaments();
            });
        }

        const hideTextFilter = document.getElementById('hideTextFilter');
        if (hideTextFilter) {
            hideTextFilter.addEventListener('change', (e) => {
                const grid = document.getElementById('filamentsGrid');
                if (grid) {
                    if (e.target.checked) {
                        grid.classList.add('hide-text');
                    } else {
                        grid.classList.remove('hide-text');
                    }
                }
            });
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('filaments.html')) {
        const manager = new FilamentsManager();
        manager.setupEventListeners();
        manager.loadFilaments();
    }
});