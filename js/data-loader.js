// ===================================
// DATA LOADER FOR CV AND PROJECTS
// ===================================

class DataLoader {
    // Load CV data and populate curriculum page
    static async loadCVData() {
        try {
            console.log('DataLoader: Fetching CV data from Google Sheets...');
            const sheetId = '1gT2fLInodV6ohZQd4eBoyqGWmZG0vK31Yp3UFJ_XkUQ';

            // Fetch all sheets using their GIDs
            const [workExp, projects, education, experiences, skills] = await Promise.all([
                this.fetchSheetByGid(sheetId, 0, 'WorkExperience'),
                this.fetchSheetByGid(sheetId, 1451783063, 'KeyProjects'),
                this.fetchSheetByGid(sheetId, 1174712494, 'Education'),
                this.fetchSheetByGid(sheetId, 167754228, 'Experiences'),
                this.fetchSheetByGid(sheetId, 547470293, 'Skills')
            ]);

            // Transform data to match expected format
            const data = {
                workExperience: this.transformWorkExperience(workExp),
                keyProjects: this.transformKeyProjects(projects),
                education: this.transformEducation(education),
                experiences: this.transformExperiences(experiences),
                skills: this.transformSkills(skills)
            };

            console.log('DataLoader: CV data loaded successfully');

            // Store data globally for map view
            window.cvData = data;

            // Only render CV on curriculum page
            if (window.location.pathname.includes('curriculum.html')) {
                const container = document.querySelector('.page-content .container');
                if (container) {
                    this.renderCVData(data);
                }
            }
        } catch (error) {
            console.error('Error loading CV data:', error);
            this.showError('Error loading CV from Google Sheets. Make sure the sheet is shared as "Anyone with the link can view"');
        }
    }
    
    static showError(message) {
        const container = document.querySelector('.page-content .container');
        if (container) {
            container.innerHTML = `<p style="color: var(--text-light); text-align: center; padding: 2rem;">${message}</p>`;
        }
    }

    static async fetchSheetByGid(sheetId, gid, sheetName) {
        try {
            // Use export format with specific GID
            const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
            console.log(`Fetching sheet: ${sheetName} (gid: ${gid})`);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${sheetName}: ${response.status}`);
            }
            const csvText = await response.text();
            console.log(`${sheetName} raw CSV:`, csvText.substring(0, 300));
            return this.parseCSV(csvText);
        } catch (error) {
            console.error(`Error fetching ${sheetName}:`, error);
            return [];
        }
    }

    static parseCSV(csv) {
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < csv.length; i++) {
            const char = csv[i];
            const nextChar = csv[i + 1];

            if (char === '"' && nextChar === '"' && inQuotes) {
                // Escaped quote inside quoted field
                currentField += '"';
                i++; // Skip next quote
            } else if (char === '"') {
                // Toggle quote mode
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                // Field separator
                currentRow.push(currentField.trim());
                currentField = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                // Row separator (only when not in quotes)
                if (char === '\r' && nextChar === '\n') {
                    i++; // Skip \n in \r\n
                }
                if (currentField || currentRow.length > 0) {
                    currentRow.push(currentField.trim());
                    if (currentRow.some(field => field)) { // Only add non-empty rows
                        rows.push(currentRow);
                    }
                    currentRow = [];
                    currentField = '';
                }
            } else {
                currentField += char;
            }
        }

        // Add last field and row
        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            if (currentRow.some(field => field)) {
                rows.push(currentRow);
            }
        }

        if (rows.length === 0) return [];

        // First row is headers
        const headers = rows[0];
        console.log('CSV Headers:', headers);
        
        // Convert remaining rows to objects
        const data = [];
        for (let i = 1; i < rows.length; i++) {
            const row = {};
            headers.forEach((header, index) => {
                row[header] = rows[i][index] || '';
            });
            data.push(row);
        }

        return data;
    }

    static getCountryFlag(countryCode) {
        if (!countryCode || countryCode.trim() === '') return '';
        // Convert country code to flag emoji using regional indicator symbols
        const code = countryCode.trim().toUpperCase();
        if (code.length !== 2) return '';
        
        try {
            // Convert to regional indicator symbols (U+1F1E6 - U+1F1FF)
            const codePoints = [...code].map(char => 0x1F1E6 - 65 + char.charCodeAt(0));
            const flag = String.fromCodePoint(...codePoints);
            console.log(`Country code ${code} converted to flag:`, flag, 'codePoints:', codePoints);
            return flag;
        } catch (e) {
            console.error('Error converting country code to flag:', countryCode, e);
            return '';
        }
    }

    static parsePapers(row) {
        // Parse published papers - support both old format (multiple columns) and new format (single column with line breaks)
        // Format: "Paper Title | URL" or just "Paper Title"
        let papersArray;
        if (row.papers) {
            // New format: single column with line breaks
            const papers = row.papers
                .replace(/\\n/g, '\n')
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n');
            papersArray = papers.split('\n').map(p => {
                const trimmed = p.trim();
                if (!trimmed) return null;
                
                // Check if paper has URL (format: "Title | URL")
                if (trimmed.includes('|')) {
                    const [title, url] = trimmed.split('|').map(s => s.trim());
                    return { title, url };
                }
                return { title: trimmed, url: null };
            }).filter(p => p);
        } else {
            // Old format: multiple columns
            papersArray = [row.paper1, row.paper2, row.paper3].filter(p => p).map(p => {
                if (p.includes('|')) {
                    const [title, url] = p.split('|').map(s => s.trim());
                    return { title, url };
                }
                return { title: p, url: null };
            });
        }
        return papersArray;
    }

    static transformWorkExperience(data) {
        return data.map(row => {
            // Debug: log the row to see what fields are available
            if (data.indexOf(row) === 0) {
                console.log('First work experience row:', row);
                console.log('Available columns:', Object.keys(row));
                console.log('location value:', row.location);
                console.log('countryCode value:', row.countryCode);
                console.log('countrycode value:', row.countrycode);
                console.log('link value:', row.link);
                console.log('tools value:', row.tools);
            }
            
            // Parse tools from comma-separated string
            // If tool doesn't have extension, add .png by default
            const toolsArray = row.tools ? row.tools.split(',').map(t => {
                const trimmed = t.trim();
                // Check if it already has an extension
                if (trimmed.includes('.')) {
                    return trimmed;
                }
                // Default to .png if no extension
                return trimmed + '.png';
            }).filter(t => t !== '') : [];
            
            if (toolsArray.length > 0) {
                console.log('Tools for', row.company, ':', toolsArray);
            }
            
            // Parse responsibilities - support both old format (multiple columns) and new format (single column with line breaks)
            let responsibilitiesArray;
            if (row.responsibilities) {
                // New format: single column with line breaks
                // Try different line break formats: \n, \r\n, or actual line breaks in CSV
                const responsibilities = row.responsibilities
                    .replace(/\\n/g, '\n')  // Handle escaped \n
                    .replace(/\r\n/g, '\n')  // Handle Windows line breaks
                    .replace(/\r/g, '\n');   // Handle Mac line breaks
                
                responsibilitiesArray = responsibilities.split('\n').map(r => r.trim()).filter(r => r);
                
                if (data.indexOf(row) === 0) {
                    console.log('Responsibilities raw:', row.responsibilities);
                    console.log('Responsibilities parsed:', responsibilitiesArray);
                }
            } else {
                // Old format: multiple columns
                responsibilitiesArray = [row.responsibility1, row.responsibility2, row.responsibility3, row.responsibility4].filter(r => r);
            }
            
            const papersArray = this.parsePapers(row);
            
            const transformed = {
                title: row.title,
                company: row.company,
                period: row.period,
                location: row.location || '',
                countryCode: row.countryCode || row.countrycode || '',
                link: row.link || '',
                companyLogo: row.companyLogo,
                responsibilities: responsibilitiesArray,
                papers: papersArray,
                tools: toolsArray
            };
            
            if (data.indexOf(row) === 0) {
                console.log('Transformed first row:', transformed);
            }
            
            return transformed;
        });
    }

    static transformKeyProjects(data) {
        return data.map(row => ({
            title: row.title,
            role: row.role,
            period: row.period,
            projectImage: row.projectImage,
            description: [row.description1, row.description2, row.description3, row.description4].filter(d => d)
        }));
    }

    static transformEducation(data) {
        return data.map(row => {
            // Parse tools from comma-separated string
            const toolsArray = row.tools ? row.tools.split(',').map(t => {
                const trimmed = t.trim();
                if (trimmed.includes('.')) {
                    return trimmed;
                }
                return trimmed + '.png';
            }).filter(t => t !== '') : [];
            
            const papersArray = this.parsePapers(row);
            
            return {
                degree: row.degree,
                institution: row.institution,
                period: row.period,
                location: row.location || '',
                countryCode: row.countryCode || row.countrycode || '',
                link: row.link || '',
                institutionLogo: row.institutionLogo,
                details: row.details,
                papers: papersArray,
                tools: toolsArray
            };
        });
    }

    static transformExperiences(data) {
        return data.map(row => ({
            title: row.title,
            organization: row.organization,
            period: row.period,
            location: row.location || '',
            countryCode: row.countryCode || row.countrycode || '',
            link: row.link || '',
            organizationLogo: row.organizationLogo,
            description: [row.description1, row.description2, row.description3].filter(d => d)
        }));
    }

    static transformSkills(data) {
        const skills = {};
        data.forEach(row => {
            const category = row.category;
            const skillList = [row.skill1, row.skill2, row.skill3, row.skill4, row.skill5, row.skill6].filter(s => s);
            skills[category] = skillList;
        });
        return skills;
    }

    // Load projects data and populate projects page
    static async loadProjectsData() {
        try {
            const response = await fetch('data/projects-data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (document.querySelector('.projects-grid')) {
                this.renderProjectsData(data);
            }
        } catch (error) {
            console.error('Error loading projects data:', error);
            this.showError('Error loading projects data');
        }
    }

    // Render CV data to the page
    static renderCVData(data) {
        const container = document.querySelector('.page-content .container');
        if (!container) return;

        container.innerHTML = `
            <div class="cv-section">
                <h3>Work Experience</h3>
                ${data.workExperience.map(job => `
                    <div class="experience-item">
                        <div class="experience-content">
                            <div class="title-row">
                                <h4>${job.title}</h4>
                                ${job.location ? `<span class="location-mobile">${job.countryCode ? `<img src="https://flagcdn.com/16x12/${job.countryCode.toLowerCase()}.png" alt="${job.countryCode}" class="country-flag">` : '<i class="fas fa-location-dot"></i>'} ${job.location}</span>` : ''}
                            </div>
                            <div class="date">${job.period}</div>
                            <p><strong>${job.link ? `<a href="${job.link}" class="company-link" target="_blank" rel="noopener">${job.company}</a>` : job.company}</strong></p>
                            <ul>
                                ${job.responsibilities.map(resp => `<li>${resp}</li>`).join('')}
                            </ul>
                            ${job.papers && job.papers.length > 0 ? `
                            <div style="margin-top: 0.75rem;">
                                <strong>Published Papers:</strong>
                                <ul style="margin-top: 0.25rem;">
                                    ${job.papers.map(paper => `<li>${paper.url ? `<a href="${paper.url}" target="_blank" rel="noopener">${paper.title}</a>` : paper.title}</li>`).join('')}
                                </ul>
                            </div>
                            ` : ''}
                            ${job.tools && job.tools.length > 0 ? `
                            <div class="software-tools">
                                ${job.tools.map(tool => {
                                    // Extract tool name from filename (remove extension and capitalize)
                                    const toolName = tool.replace(/\.(png|svg|jpg|jpeg)$/i, '')
                                        .split(/[-_]/)
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(' ');
                                    return `<div class="tool-item">
                                        <img src="assets/images/tools/${tool}" alt="${toolName}" class="tool-icon">
                                        <span class="tool-name">${toolName}</span>
                                    </div>`;
                                }).join('')}
                            </div>
                            ` : ''}
                        </div>
                        <div class="experience-visual">
                            ${job.location ? `<div class="location-info">${job.countryCode ? `<img src="https://flagcdn.com/16x12/${job.countryCode.toLowerCase()}.png" alt="${job.countryCode}" class="country-flag">` : '<i class="fas fa-location-dot"></i>'} ${job.location}</div>` : ''}
                            <div class="company-logo">
                                <img src="${job.companyLogo}" alt="${job.company}" class="company-image">
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="cv-section">
                <h3>Key Projects</h3>
                ${data.keyProjects.map(project => `
                    <div class="experience-item">
                        <div class="experience-content">
                            <h4>${project.title}</h4>
                            <div class="date">${project.period}</div>
                            <p><strong>${project.role}</strong></p>
                            <ul>
                                ${project.description.map(desc => `<li>${desc}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="project-image">
                            <img src="${project.projectImage}" alt="${project.title}" class="project-photo" style="width: 320px !important; height: auto !important; display: block !important;">
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="cv-section">
                <h3>Technical Skills</h3>
                <div class="skills-grid">
                    ${Object.entries(data.skills).map(([category, skills]) => `
                        <div class="skill-category">
                            <h4>${category}</h4>
                            <ul class="skill-list">
                                ${skills.map(skill => `<li>${skill}</li>`).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="cv-section">
                <h3>Education</h3>
                ${data.education.map(edu => `
                    <div class="education-item">
                        <div class="education-content">
                            <div class="title-row">
                                <h4>${edu.degree}</h4>
                                ${edu.location ? `<span class="location-mobile">${edu.countryCode ? `<img src="https://flagcdn.com/16x12/${edu.countryCode.toLowerCase()}.png" alt="${edu.countryCode}" class="country-flag">` : '<i class="fas fa-location-dot"></i>'} ${edu.location}</span>` : ''}
                            </div>
                            <div class="date">${edu.period}</div>
                            <p><strong>${edu.link ? `<a href="${edu.link}" class="company-link" target="_blank" rel="noopener">${edu.institution}</a>` : edu.institution}</strong></p>
                            <p>${edu.details}</p>
                            ${edu.papers && edu.papers.length > 0 ? `
                            <div style="margin-top: 0.75rem;">
                                <strong>Published Papers:</strong>
                                <ul style="margin-top: 0.25rem;">
                                    ${edu.papers.map(paper => `<li>${paper.url ? `<a href="${paper.url}" target="_blank" rel="noopener">${paper.title}</a>` : paper.title}</li>`).join('')}
                                </ul>
                            </div>
                            ` : ''}
                            ${edu.tools && edu.tools.length > 0 ? `
                            <div class="software-tools">
                                ${edu.tools.map(tool => {
                                    const toolName = tool.replace(/\.(png|svg|jpg|jpeg)$/i, '')
                                        .split(/[-_]/)
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(' ');
                                    return `<div class="tool-item">
                                        <img src="assets/images/tools/${tool}" alt="${toolName}" class="tool-icon">
                                        <span class="tool-name">${toolName}</span>
                                    </div>`;
                                }).join('')}
                            </div>
                            ` : ''}
                        </div>
                        <div class="experience-visual">
                            ${edu.location ? `<div class="location-info">${edu.countryCode ? `<img src="https://flagcdn.com/16x12/${edu.countryCode.toLowerCase()}.png" alt="${edu.countryCode}" class="country-flag">` : '<i class="fas fa-location-dot"></i>'} ${edu.location}</div>` : ''}
                            <div class="university-logo">
                                <img src="${edu.institutionLogo}" alt="${edu.institution}" class="university-image">
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="cv-section">
                <h3>Experiences</h3>
                ${data.experiences.map(exp => `
                    <div class="experience-item">
                        <div class="experience-content">
                            <div class="title-row">
                                <h4>${exp.title}</h4>
                                ${exp.location ? `<span class="location-mobile">${exp.countryCode ? `<img src="https://flagcdn.com/16x12/${exp.countryCode.toLowerCase()}.png" alt="${exp.countryCode}" class="country-flag">` : '<i class="fas fa-location-dot"></i>'} ${exp.location}</span>` : ''}
                            </div>
                            <div class="date">${exp.period}</div>
                            <p><strong>${exp.link ? `<a href="${exp.link}" class="company-link" target="_blank" rel="noopener">${exp.organization}</a>` : exp.organization}</strong></p>
                            <ul>
                                ${exp.description.map(desc => `<li>${desc}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="experience-visual">
                            ${exp.location ? `<div class="location-info">${exp.countryCode ? `<img src="https://flagcdn.com/16x12/${exp.countryCode.toLowerCase()}.png" alt="${exp.countryCode}" class="country-flag">` : '<i class="fas fa-location-dot"></i>'} ${exp.location}</div>` : ''}
                            <div class="company-logo">
                                <img src="${exp.organizationLogo}" alt="${exp.organization}" class="company-image">
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Render projects data to the page
    static renderProjectsData(data) {
        const container = document.querySelector('.page-content .container');
        if (!container) return;

        container.innerHTML = Object.entries(data.categories).map(([categoryName, projects]) => `
            <div class="section">
                <h2>${categoryName}</h2>
                <div class="projects-grid">
                    ${projects.map(project => `
                        <div class="project-card">
                            <div class="project-image">
                                ${project.icon}
                            </div>
                            <div class="project-content">
                                <h3>${project.title}</h3>
                                <p>${project.description}</p>
                                
                                <div class="project-tags">
                                    ${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                                </div>
                                
                                <div class="project-links">
                                    ${project.links.map(link => `<a href="${link.url}" class="project-link">${link.text}</a>`).join('')}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
}

// ===================================
// INITIALIZATION
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    const pathname = window.location.pathname;
    console.log('DataLoader: Page loaded, pathname:', pathname);

    // Load CV data on curriculum and map-vitae pages
    if (pathname.includes('curriculum.html') || pathname.includes('map-vitae.html')) {
        console.log('DataLoader: Loading CV data...');
        // Load immediately without delay
        DataLoader.loadCVData();
    }

    // Load projects data on projects page
    if (pathname.includes('projects.html')) {
        console.log('DataLoader: Loading projects data...');
        DataLoader.loadProjectsData();
    }
});