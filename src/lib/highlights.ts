// The four boxes under the home page greeting. They are not typed by hand: they come from the CV page, so the two
// can't disagree. "Now" is the current job, "Certified" the first certifications, "Education" the latest degree.
export interface Highlight {
  label: string;
  value: string;
}

interface Sources {
  work: { company: string; period: string }[];
  certifications: { title: string }[];
  education: { degree: string }[];
}

/** "MSc in Mechanical Engineering" -> "MSc Mech. Eng": no university, short enough for a box. */
export function shortDegree(degree: string): string {
  return degree
    .replace(/\s+in\s+/i, " ")
    .replace(/Mechanical Engineering/i, "Mech. Eng")
    .replace(/\s+/g, " ")
    .trim();
}

export function highlightsFrom({ work, certifications, education }: Sources, maxCertifications = 2): Highlight[] {
  const out: Highlight[] = [];
  const job = work[0];
  if (job) {
    const ongoing = /present|now|current/i.test(job.period);
    const year = job.period.match(/\d{4}/)?.[0];
    out.push(ongoing ? { label: "Now", value: year ? `${job.company} · ${year}` : job.company } : { label: "Latest job", value: job.company });
  }
  for (const c of certifications.slice(0, maxCertifications)) out.push({ label: "Certified", value: c.title });
  const degree = education[0];
  if (degree) out.push({ label: "Education", value: shortDegree(degree.degree) });
  return out;
}
