# Luis Matias - Portfolio Website

A modern, responsive portfolio website for mechanical designers with dark/light theme support and easy content management.

## ✨ Features

- **🎨 Dark/Light Theme Toggle** - Switch between themes with one click
- **📱 Fully Responsive** - Works perfectly on desktop, tablet, and mobile
- **⚡ Fast Loading** - Optimized performance with minimal animations
- **📝 Easy Content Management** - Update content through simple JSON files
- **🔗 Social Media Integration** - LinkedIn and Instagram links
- **📊 Data-Driven** - CV and projects load from JSON configuration

## 🎯 Easy Content Management

Your website content is managed through JSON files in the `data/` folder:

### ⚙️ Site Configuration (`data/site-config.json`)
**Master settings for your entire website:**

```json
{
  "personalInfo": {
    "name": "Your Full Name",
    "firstName": "YOUR",
    "lastName": "NAME", 
    "title": "Your Job Title",
    "subtitle": "Your • Skills • Here",
    "profileImage": "path/to/your/photo.jpg"
  },
  "socialMedia": {
    "linkedin": { "url": "https://linkedin.com/in/yourprofile" },
    "instagram": { "url": "https://instagram.com/yourprofile" }
  }
}
```

### 📄 CV/Resume Content (`data/cv-data.json`)
**Complete curriculum vitae data:**

- **Work Experience** - Job history with responsibilities
- **Key Projects** - Important projects and achievements  
- **Technical Skills** - Organized by categories (CAD, Programming, etc.)
- **Education** - Degrees and certifications
- **Experiences** - Internships and volunteer work

### 💻 Projects Content (`data/projects-data.json`)
**Project portfolio organized by categories:**

- **Python Automation** - Scripts and tools
- **Excel VBA Tools** - Spreadsheet applications
- **3D Printing Projects** - Custom designs and prototypes
- **Laser Engraving & CNC** - Manufacturing projects

## 🔧 How to Update Your Website

### 🔗 Update Social Media Links
Edit `data/site-config.json`:
```json
{
  "socialMedia": {
    "linkedin": { "url": "https://linkedin.com/in/your-username" },
    "instagram": { "url": "https://instagram.com/your-username" }
  }
}
```

### 👤 Change Personal Information
Edit `data/site-config.json`:
```json
{
  "personalInfo": {
    "name": "Your Full Name",
    "firstName": "YOUR",
    "lastName": "NAME",
    "title": "Your Job Title",
    "subtitle": "Your Skills • And • Expertise",
    "profileImage": "https://your-image-url.com/photo.jpg"
  }
}
```

### 💼 Add Work Experience
Edit `data/cv-data.json` in the `workExperience` array:
```json
{
  "title": "Senior Mechanical Engineer",
  "company": "Your Company Name",
  "period": "2024 - Present",
  "responsibilities": [
    "Led design projects for industrial machinery",
    "Managed team of 5 junior engineers",
    "Reduced production costs by 25%"
  ]
}
```

### 🚀 Add New Project
Edit `data/projects-data.json` in the appropriate category:
```json
{
  "title": "Automated Assembly System",
  "icon": "🤖",
  "description": "Designed and implemented fully automated assembly line for electronic components with 99.5% accuracy rate.",
  "tags": ["Python", "Automation", "CAD", "Manufacturing"],
  "links": [
    { "text": "GitHub", "url": "https://github.com/your-repo" },
    { "text": "Demo Video", "url": "https://youtube.com/watch?v=..." }
  ]
}
```

### 🎨 Change Theme Colors
Edit `css/style.css` variables:
```css
:root {
    --primary-blue: #e74c3c;     /* Change to red */
    --dark-blue: #c0392b;        /* Darker shade */
}
```

### 🛠️ Add New Skill Category
Edit `data/cv-data.json` in the `skills` object:
```json
"New Technology": [
  "Skill 1",
  "Skill 2", 
  "Skill 3"
]
```

## 📁 File Structure

```
my-website/
├── data/                    # 📊 Content Management
│   ├── site-config.json    # Personal info & social links
│   ├── cv-data.json        # Resume/CV content
│   └── projects-data.json  # Project portfolio
├── js/                     # ⚡ Functionality
│   ├── script.js          # Main website features
│   ├── data-loader.js     # Loads CV & project data
│   └── config-loader.js   # Loads site configuration
├── css/
│   └── style.css          # 🎨 All styling & themes
├── assets/
│   └── images/            # 📸 Your photos & images
├── index.html             # 🏠 Homepage
├── curriculum.html        # 📄 CV page (auto-generated)
├── projects.html          # 💻 Projects (auto-generated)
├── photography.html       # 📸 Photo gallery
└── README.md             # 📖 This guide
```

## 🎨 Advanced Customization

### Theme Colors
Edit CSS variables in `css/style.css`:
```css
:root {
    --primary-blue: #your-color;
    --dark-blue: #darker-shade;
}
```

### Photography Page
Replace placeholder photos in `photography.html` with your actual travel photos.

### Add More Social Links
Modify the footer HTML in all pages to add GitHub, Twitter, etc.

## 🚀 Publishing Your Website

### Option 1: GitHub Pages (Free)
1. Create a GitHub repository
2. Upload all files
3. Enable GitHub Pages in repository settings
4. Your site will be live at `username.github.io/repository-name`

### Option 2: Netlify (Free)
1. Drag and drop your website folder to [netlify.com](https://netlify.com)
2. Get instant live URL
3. Automatic updates when you change files

### Option 3: Traditional Web Hosting
1. Upload files via FTP to your hosting provider
2. Point domain to your hosting account

## 🔧 Maintenance

- **Update content**: Edit JSON files and refresh
- **Change colors**: Modify CSS variables
- **Add photos**: Replace image URLs
- **Backup**: Keep copies of your JSON files

Your website automatically loads content from JSON files - no HTML editing required! 🎉