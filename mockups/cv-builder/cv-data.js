// The content of the first template (Luis' uploaded CV, no phone) and the code that draws one page of it.
// Every element with data-paper="1" or "2" and a data-bg colour name gets that page drawn into it.
const E = (company, role, place, dates, bullets, extra = "") =>
  `<div class="entry"><div class="head"><span><b>${company}</b> ○ ${role}<br><span class="muted2">${place}</span></span><span>${dates}</span></div>${extra}<ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul></div>`;

const PAGE1 = `
<h1>Luis Matias</h1>
<div class="contact"><span>✉ luisdafmatias@gmail.com</span><span>◷ 20/06/1994</span><span>▣ Category B · from Portugal</span>
<span>🗣 Portuguese (Native) · English (C1)</span><span></span><span class="link">lmatias.com/luisdafmatias</span></div>
<div class="line"><b>Skills / Tools</b>&nbsp; SolidWorks, Solid Edge, Teamcenter, 3D Printing, Excel, Ansys, Abaqus, Matlab, Python</div>
<div class="line"><b>Interests</b>&nbsp; CAD, Mechanical Design, DFM, DFA, CNC Machines, 3D Printing, Automation, Programming, Product Development, Additive Manufacturing, Manufacturing Engineer</div>
<h2>Work</h2>
${E("Skartek", "Mechanical Design Engineer", "Vlčkovce, Slovakia", "Aug 2025 – Present", [
  "Designing conceptual mechanical solutions to secure customer buy-in and formalize service contracts",
  "<b>DFM &amp; Process Optimization</b> – Applying Design for Manufacturing principles across CNC machining, welding, laser cutting and 3D Printing to optimize part geometry and ensure structural durability",
  "<b>Collision Mitigation &amp; System Adaptation</b> – Re-engineering active machine assemblies to resolve mechanical interference and integrate customer-driven modifications, ensuring zero-collision performance and enhanced operational safety",
  "<b>PLM &amp; CAD Integration</b> – Utilizing Solid Edge for precision modeling and Teamcenter for robust version control, BOM management, and cross-departmental collaboration"])}
${E("Forvia", "VIE Development Engineer · Manufacturing Engineer", "Trnava, Slovakia", "May 2023 – Dec 2024", [
  "Working in Instrument Panel programs: Citroën C3 and Opel Frontera",
  "Define and articulate the Engineering Levels required for production, serving as a key liaison between R&amp;D and the plant team to ensure seamless collaboration",
  "Validate mockups for both interim and permanent solutions, ensuring functionality and compliance with design standards",
  "Prepare production documents including Visual BOM and 3D models in PLM system",
  "Assist manufacturing in defining the sequence of assembly operations during the initial stages of the conveyor production process",
  "Independently develop 3D printing solutions for mockups, workstation and conveyor modifications, and production support tools",
  "Develop Excel VBA scripts to streamline stock tracking and ensure accurate inventory"])}
${E("Forvia", "VIE Program Engineer", "Gorzów Wielkopolski, Poland", "Aug 2022 – May 2023", [
  "Working in Door Panel programs: Jeep Avenger, Fiat 600 and Alfa Romeo Junior",
  "Support quality department in capabilities studies",
  "Support suppliers in Gage R&amp;R studies to ensure RPS system definition",
  "Support in the Meisterbock build"])}
<div class="pageno">1 / 2</div>`;

const PAGE2 = `
${E("INEGI", "Research Fellow", "Porto, Portugal", "Dec 2021 – July 2022", [
  "Computer Vision – Using Python for 3D reconstruction of heart arteries (Region Growing method)", "User interface with PyQt"],
  `<div class="sub"><b>Project</b> “Dealing with CT Cardiac Imaging Using Python: An Approach for Future Hemodynamic Simulations”</div>`)}
<h2>Studies</h2>
${E("University of Porto", "M.Sc. Mechanical Engineer", "Porto, Portugal", "July 2022", [
  "Semi-automatic method to create arteries with stents using SolidWorks and Creo based on CT images",
  "Hemodynamics simulations in ANSYS Fluent with stent applied in the arteries"],
  `<div class="sub"><b>Thesis</b> “Semi-Automatic Method of Stent Development in Coronary Arteries with Stenosis – Hemodynamic Simulations”</div>`)}
<h2>My projects</h2>
${E("CNC Milling Machine", "", "", "On going", ["Under development in design phase", "Designing in SolidWorks"])}
${E("CNC Diode Laser Engraver", "", "", "Jan 2025 – March 2025", ["Finished project and working machine", "Designed in SolidWorks", "Pinion and belt driven system with NEMA 17 stepper motors, V-Slot profile frame", "3 axis with semi-automatic focus"])}
<h2>Experiences</h2>
${E("Elephant Nature Park", "Volunteering · Elephant Caretaker", "Chiang Mai, Thailand", "2017 (1 week)", ["Taking care of abandoned and abused elephants and dogs"])}
${E("RMUTR", "Internship · Professor Assistant", "Phutthamonthon, Thailand", "2017 (3 months)", ["Support students in their school projects", "Teach Mathematics and Solid Mechanics to the students"])}
<h2>Certifications</h2>
<div class="certs"><div><b>SolidWorks CSWP</b> – CAD Design Professional<br>May 2025</div><div><b>Solid Edge</b> Professional Level<br>April 2026</div></div>
<div class="pageno">2 / 2</div>`;

function drawPapers() {
  document.querySelectorAll("[data-paper]").forEach((el) => {
    el.classList.add("paper", "bg-" + (el.dataset.bg || "white"));
    el.innerHTML = el.dataset.paper === "2" ? PAGE2 : PAGE1;
  });
}
document.addEventListener("DOMContentLoaded", drawPapers);

// Test versions: the old CVs differ only by the colour of the page.
const VERSIONS = [
  { id: 7, name: "Skartek – generic", bg: "white", date: "6 Nov 2026", from: 6, tag: "Latest", note: "Added Skartek bullets, new certification dates.", live: true, changes: "+4 bullets in Skartek · Solid Edge date updated" },
  { id: 6, name: "Faurecia application", bg: "cream", date: "21 Sep 2026", from: 5, tag: "Application", note: "Shorter interests line, Forvia first.", changes: "Interests line shortened · section order changed" },
  { id: 5, name: "Master thesis focus", bg: "blue", date: "2 Jun 2026", from: 4, tag: "Application", note: "Studies moved above work.", changes: "Studies before Work · thesis paper added" },
  { id: 4, name: "Generic 2025", bg: "green", date: "12 Mar 2026", from: 3, tag: "Generic", note: "Laser engraver project added.", changes: "+1 project (Laser Engraver)" },
  { id: 3, name: "INEGI research", bg: "rose", date: "30 Aug 2025", from: 2, tag: "Application", note: "Research fellow first, Python skills up.", changes: "INEGI moved first · Python added to skills" },
  { id: 2, name: "First version", bg: "grey", date: "4 Jan 2025", from: 1, tag: "Generic", note: "", changes: "Fixed typos" },
  { id: 1, name: "Original Word CV", bg: "white", date: "10 Nov 2024", from: null, tag: "Imported", note: "Imported from the uploaded PDF (first template).", changes: "Imported" },
];
