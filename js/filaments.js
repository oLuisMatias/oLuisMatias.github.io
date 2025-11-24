// Filaments Page JavaScript
class FilamentsManager {
    constructor() {
        this.filaments = [];
        this.filteredFilaments = [];
        this.isTableView = false;
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

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"' && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else if (char === '"') {
                // Toggle quote mode
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                // Field separator
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    parseCSV(csv) {
        const lines = csv.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];

        // Parse headers - keep original case
        const rawHeaders = this.parseCSVLine(lines[0]);
        const data = [];

        // Debug: log headers to see what columns we have
        console.log('CSV Headers (raw):', rawHeaders);

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const row = {};

            rawHeaders.forEach((header, index) => {
                const headerLower = header.toLowerCase();
                const value = values[index] || '';

                if (headerLower === 'owned') {
                    row[headerLower] = value.toUpperCase() === 'TRUE';
                } else if (headerLower === 'td') {
                    // Store TD with lowercase key
                    row['td'] = value;
                } else {
                    // Store other fields with their original camelCase names
                    row[header] = value;
                }
            });

            // Debug: log first row to check all values
            if (i === 1) {
                console.log('First row data:', row);
            }

            data.push(row);
        }

        console.log(`Total filaments loaded: ${data.length}`);
        return data;
    }

    renderFilamentCard(filament) {
        const tdValue = (filament.td && filament.td.trim() !== '') ? filament.td : 'NA';
        const tdDisplay = `TD: ${tdValue}`;

        return `
        <div class="filament-card ${filament.owned ? 'owned' : 'not-owned'}" data-brand="${filament.brand}" data-material="${filament.materialType}">
            <div class="filament-swatch" style="background-color: ${filament.hexColor};"></div>
            <div class="filament-info">
                <div class="filament-brand">${filament.brand}</div>
                <div class="filament-material-type">${filament.materialType}</div>
                <div class="filament-color-name">${filament.colorName}</div>
                <div class="filament-td">${tdDisplay}</div>
                <div class="filament-reference">${filament.reference}</div>
            </div>
        </div>
        `;
    }

    renderTableRow(filament) {
        const tdValue = (filament.td && filament.td.trim() !== '') ? filament.td : 'NA';

        return `
        <tr class="${filament.owned ? 'owned' : 'not-owned'}">
            <td class="color-cell">
                <div class="color-swatch" style="background-color: ${filament.hexColor};"></div>
                <span>${filament.colorName}</span>
            </td>
            <td class="brand-cell">${filament.brand}</td>
            <td>${filament.materialType}</td>
            <td class="td-cell">${tdValue}</td>
            <td class="reference-cell">${filament.reference}</td>
        </tr>
        `;
    }

    renderFilaments() {
        const grid = document.getElementById('filamentsGrid');
        if (!grid) return;

        if (this.isTableView) {
            // Render table view
            const ownershipFilter = document.querySelector('input[name="ownershipFilter"]:checked')?.value || 'owned';

            if (ownershipFilter === 'all') {
                const ownedFilaments = this.filteredFilaments.filter(f => f.owned === true);
                const notOwnedFilaments = this.filteredFilaments.filter(f => f.owned === false);

                let html = '';

                if (ownedFilaments.length > 0) {
                    html += `
                        <div class="filaments-section-header">
                            <h3>Owned</h3>
                        </div>
                        <table class="filaments-table">
                            <thead>
                                <tr>
                                    <th>Color</th>
                                    <th>Brand</th>
                                    <th>Type</th>
                                    <th>TD</th>
                                    <th>Reference</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ownedFilaments.map(f => this.renderTableRow(f)).join('')}
                            </tbody>
                        </table>
                    `;
                }

                if (notOwnedFilaments.length > 0) {
                    html += `
                        <div class="filaments-section-header">
                            <h3>Not Owned</h3>
                        </div>
                        <table class="filaments-table">
                            <thead>
                                <tr>
                                    <th>Color</th>
                                    <th>Brand</th>
                                    <th>Type</th>
                                    <th>TD</th>
                                    <th>Reference</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${notOwnedFilaments.map(f => this.renderTableRow(f)).join('')}
                            </tbody>
                        </table>
                    `;
                }

                grid.innerHTML = html;
            } else {
                grid.innerHTML = `
                    <table class="filaments-table">
                        <thead>
                            <tr>
                                <th>Color</th>
                                <th>Brand</th>
                                <th>Type</th>
                                <th>TD</th>
                                <th>Reference</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.filteredFilaments.map(f => this.renderTableRow(f)).join('')}
                        </tbody>
                    </table>
                `;
            }
        } else {
            // Render card view
            const ownershipFilter = document.querySelector('input[name="ownershipFilter"]:checked')?.value || 'owned';

            if (ownershipFilter === 'all') {
                const ownedFilaments = this.filteredFilaments.filter(f => f.owned === true);
                const notOwnedFilaments = this.filteredFilaments.filter(f => f.owned === false);

                let html = '';

                if (ownedFilaments.length > 0) {
                    html += `
                        <div class="filaments-section-header">
                            <h3>Owned</h3>
                        </div>
                        <div class="filaments-section-grid">
                            ${ownedFilaments.map(f => this.renderFilamentCard(f)).join('')}
                        </div>
                    `;
                }

                if (notOwnedFilaments.length > 0) {
                    html += `
                        <div class="filaments-section-header">
                            <h3>Not Owned</h3>
                        </div>
                        <div class="filaments-section-grid">
                            ${notOwnedFilaments.map(f => this.renderFilamentCard(f)).join('')}
                        </div>
                    `;
                }

                grid.innerHTML = html;
            } else {
                grid.innerHTML = `
                    <div class="filaments-section-grid">
                        ${this.filteredFilaments.map(f => this.renderFilamentCard(f)).join('')}
                    </div>
                `;
            }
        }
    }

    populateFilters() {
        // Populate brand checkboxes
        const brands = [...new Set(this.filaments.map(f => f.brand))].sort();
        const brandList = document.getElementById('brandList');
        if (brandList) {
            brandList.innerHTML = brands.map(brand => `
                <div class="filter-option">
                    <input type="checkbox" id="brand-${brand}" value="${brand}" class="brand-checkbox">
                    <label for="brand-${brand}">${brand}</label>
                </div>
            `).join('');
        }

        // Populate type checkboxes
        const materials = [...new Set(this.filaments.map(f => f.materialType))].sort();
        const typeList = document.getElementById('typeList');
        if (typeList) {
            typeList.innerHTML = materials.map(material => `
                <div class="filter-option">
                    <input type="checkbox" id="type-${material}" value="${material}" class="type-checkbox">
                    <label for="type-${material}">${material}</label>
                </div>
            `).join('');
        }
    }

    sortFilaments() {
        const sortBy = document.getElementById('sortBy')?.value;
        const sortOrderBtn = document.getElementById('sortOrder');
        const isDescending = sortOrderBtn?.classList.contains('descending');

        if (!sortBy) return; // No sorting selected

        this.filteredFilaments.sort((a, b) => {
            let aValue, bValue;

            if (sortBy === 'td') {
                // Convert TD to number, treat 'NA' or empty as Infinity (goes to end)
                aValue = (a.td && a.td !== 'NA' && a.td.trim() !== '') ? parseFloat(a.td) : Infinity;
                bValue = (b.td && b.td !== 'NA' && b.td.trim() !== '') ? parseFloat(b.td) : Infinity;
            }

            // Sort ascending or descending
            if (isDescending) {
                return bValue - aValue;
            } else {
                return aValue - bValue;
            }
        });
    }

    filterFilaments() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();

        // Get selected brands
        const selectedBrands = Array.from(document.querySelectorAll('.brand-checkbox:checked')).map(cb => cb.value);

        // Get selected types
        const selectedTypes = Array.from(document.querySelectorAll('.type-checkbox:checked')).map(cb => cb.value);

        // Get selected ownership radio button
        const ownershipFilter = document.querySelector('input[name="ownershipFilter"]:checked')?.value || 'owned';

        // Check if sorting by TD
        const sortBy = document.getElementById('sortBy')?.value;

        this.filteredFilaments = this.filaments.filter(filament => {
            const matchesSearch = filament.brand.toLowerCase().includes(searchTerm) ||
                filament.colorName.toLowerCase().includes(searchTerm) ||
                filament.materialType.toLowerCase().includes(searchTerm) ||
                filament.colorGroup.toLowerCase().includes(searchTerm);

            const matchesBrand = selectedBrands.length === 0 || selectedBrands.includes(filament.brand);
            const matchesMaterial = selectedTypes.length === 0 || selectedTypes.includes(filament.materialType);

            // Ownership filter: owned, notOwned, or all
            let matchesOwnership = true;
            if (ownershipFilter === 'owned') {
                matchesOwnership = filament.owned === true;
            } else if (ownershipFilter === 'notOwned') {
                matchesOwnership = filament.owned === false;
            }
            // if 'all', matchesOwnership stays true

            // If sorting by TD, exclude items with NA or empty TD
            let hasTD = true;
            if (sortBy === 'td') {
                hasTD = filament.td && filament.td.trim() !== '' && filament.td !== 'NA';
            }

            return matchesSearch && matchesBrand && matchesMaterial && matchesOwnership && hasTD;
        });

        // Apply sorting
        this.sortFilaments();

        this.renderFilaments();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const ownershipRadios = document.querySelectorAll('input[name="ownershipFilter"]');
        const sortBySelect = document.getElementById('sortBy');
        const sortOrderBtn = document.getElementById('sortOrder');

        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterFilaments());
        }

        // Add event listeners to all ownership radio buttons
        ownershipRadios.forEach(radio => {
            radio.addEventListener('change', () => this.filterFilaments());
        });

        // Sort by dropdown
        if (sortBySelect) {
            sortBySelect.addEventListener('change', () => this.filterFilaments());
        }

        // Sort order toggle button
        if (sortOrderBtn) {
            sortOrderBtn.addEventListener('click', () => {
                sortOrderBtn.classList.toggle('descending');
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

        // Setup expandable filter headers
        document.querySelectorAll('.filter-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.closest('.filter-section');
                section.classList.toggle('collapsed');
            });
        });

        // Setup filter checkbox listeners (delegated event handling)
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('brand-checkbox') ||
                e.target.classList.contains('type-checkbox')) {
                this.filterFilaments();
            }
        });

        // View toggle button
        const viewToggleBtn = document.getElementById('viewToggle');
        if (viewToggleBtn) {
            viewToggleBtn.addEventListener('click', () => {
                this.isTableView = !this.isTableView;
                viewToggleBtn.classList.toggle('table-view');

                // Change icon
                const icon = viewToggleBtn.querySelector('i');
                if (this.isTableView) {
                    icon.className = 'fas fa-table-cells-large';
                } else {
                    icon.className = 'fas fa-table-cells';
                }

                this.renderFilaments();
            });
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function () {
    if (window.location.pathname.includes('filaments.html')) {
        const manager = new FilamentsManager();
        manager.setupEventListeners();
        manager.loadFilaments();
    }
});