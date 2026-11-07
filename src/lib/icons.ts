// The few Tabler icons that pages built in the browser need (the editor and its preview). Bundled, so no extra requests.
const files = import.meta.glob<string>(
  "../../node_modules/@tabler/icons/icons/outline/{download,file-description,star,mail,phone,cake,car,map-pin,language,world,brand-linkedin,arrow-left,arrow-right,player-play,arrows-maximize,hand-move,grip-vertical,arrow-up,arrow-down,copy,trash,file-certificate,rosette-discount-check,arrow-back-up,arrow-forward-up,plus,dots,layout-columns,layout-rows,typography,photo,layout-grid,cube-3d-sphere,brand-youtube,table,heading,link,device-desktop,device-tablet,device-mobile,x,check,eye,eye-off,external-link}.svg",
  { query: "?raw", import: "default", eager: true },
);

export function iconSvg(name: string, size = 17): string {
  const raw = files[`../../node_modules/@tabler/icons/icons/outline/${name}.svg`] ?? "";
  const inner = raw
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none"\s*\/>/, "");
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// The CV's contact icons: Font Awesome Free, solid (src/assets/cv-icons, license in that folder). The names are the ones the
// CV code uses; the files are named as in Font Awesome.
const cvFiles = import.meta.glob<string>("../assets/cv-icons/*.svg", { query: "?raw", import: "default", eager: true });
const cvNames: Record<string, string> = {
  mail: "envelope", phone: "phone", cake: "cake-candles", car: "car", "map-pin": "location-dot",
  language: "comments", world: "globe", "brand-linkedin": "linkedin",
};

/** A contact icon as inline SVG: filled with the text color (`currentColor`), fitted into a size x size box. */
export function cvIconSvg(name: string, size = 15): string {
  const raw = cvFiles[`../assets/cv-icons/${cvNames[name] ?? name}.svg`] ?? "";
  const viewBox = /viewBox="([^"]+)"/.exec(raw)?.[1] ?? "0 0 512 512";
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<\/svg>\s*$/, "");
  return `<svg class="icon" width="${size}" height="${size}" viewBox="${viewBox}" fill="currentColor" aria-hidden="true">${inner}</svg>`;
}
