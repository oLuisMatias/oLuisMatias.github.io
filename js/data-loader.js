// Data loader for CV and Projects
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

            console.log('DataLoader: CV data loaded:', data);

            const container = document.querySelector('.page-content .container');
            if (container) {
                this.renderCVData(data);
            }
        } catch (error) {
            console.error('Error loading CV data:', error);
            alert('Error loading CV from Google Sheets. Make sure the sheet is shared as "Anyone with the link can view"');
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
        const lines = csv.split('\n').filter(line => line.trim());
        if (lines.length === 0) return [];

        // Parse header row
        const headers = this.parseCSVLine(lines[0]);
        console.log('CSV Headers:', headers);
        const data = [];

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            console.log('CSV Row values:', values);
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            data.push(row);
        }

        return data;
    }

    static parseCSVLine(line) {
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
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);

        // Clean up values (remove quotes, trim)
        return result.map(v => v.trim().replace(/^"|"$/g, ''));
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
            
            const transformed = {
                title: row.title,
                company: row.company,
                period: row.period,
                location: row.location || '',
                countryCode: row.countryCode || row.countrycode || '',
                link: row.link || '',
                companyLogo: row.companyLogo,
                responsibilities: [row.responsibility1, row.responsibility2, row.responsibility3, row.responsibility4].filter(r => r),
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
        return data.map(row => ({
            degree: row.degree,
            institution: row.institution,
            period: row.period,
            institutionLogo: row.institutionLogo,
            details: row.details
        }));
    }

    static transformExperiences(data) {
        return data.map(row => ({
            title: row.title,
            organization: row.organization,
            period: row.period,
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
            const data = await response.json();

            if (document.querySelector('.projects-grid')) {
                this.renderProjectsData(data);
            }
        } catch (error) {
            console.error('Error loading projects data:', error);
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
                            <h4>${edu.degree}</h4>
                            <div class="date">${edu.period}</div>
                            <p><strong>${edu.institution}</strong></p>
                            <p>${edu.details}</p>
                        </div>
                        <div class="university-logo">
                            <img src="${edu.institutionLogo}" alt="${edu.institution}" class="university-image" style="width: 320px !important; height: auto !important; display: block !important;">
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="cv-section">
                <h3>Experiences</h3>
                ${data.experiences.map(exp => `
                    <div class="experience-item">
                        <div class="experience-content">
                            <h4>${exp.title}</h4>
                            <div class="date">${exp.period}</div>
                            <p><strong>${exp.organization}</strong></p>
                            <ul>
                                ${exp.description.map(desc => `<li>${desc}</li>`).join('')}
                            </ul>
                        </div>
                        <div class="company-logo">
                            <img src="${exp.organizationLogo}" alt="${exp.organization}" class="company-image" style="width: 320px !important; height: auto !important; display: block !important;">
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

// Load data when page loads
document.addEventListener('DOMContentLoaded', function () {
    console.log('DataLoader: Page loaded, pathname:', window.location.pathname);

    // Load CV data on curriculum page
    if (window.location.pathname.includes('curriculum.html')) {
        console.log('DataLoader: Loading CV data...');
        DataLoader.loadCVData();
    }

    // Load projects data on projects page
    if (window.location.pathname.includes('projects.html')) {
        console.log('DataLoader: Loading projects data...');
        DataLoader.loadProjectsData();
    }
});


