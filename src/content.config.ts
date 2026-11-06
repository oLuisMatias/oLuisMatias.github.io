import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const yml = (dir: string) => glob({ pattern: "**/*.{yml,yaml}", base: `./src/content/${dir}` });

const common = {
  visible: z.boolean().default(true),
  order: z.number().default(100),
};
/** A line under a CV card: `kind` is the label in front of it ("Paper" unless the card says otherwise; empty = no label). */
const paper = z.object({ kind: z.string().default("Paper"), title: z.string(), url: z.string().optional().default("") });
/** Sides of an image that get empty space around it (5% of the frame width each). */
const spacing = z.array(z.enum(["top", "right", "bottom", "left"])).default([]);

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().default("") }),
  z.object({
    type: z.literal("image"),
    src: z.string(),
    alt: z.string().optional().default(""),
    caption: z.string().optional().default(""),
    spacing,
  }),
  z.object({
    type: z.literal("gallery"),
    images: z.array(z.object({ src: z.string(), caption: z.string().optional().default("") })).default([]),
  }),
  z.object({ type: z.literal("model"), src: z.string(), caption: z.string().optional().default("") }),
  z.object({ type: z.literal("youtube"), url: z.string() }),
  z.object({ type: z.literal("heading"), text: z.string().default("") }),
  z.object({ type: z.literal("table"), header: z.boolean().default(true), rows: z.array(z.array(z.string())).default([]) }),
  z.object({ type: z.literal("button"), label: z.string().default(""), url: z.string().default("") }),
]);

/** A box holds one thing: a block, one of the project's own parts, or nothing yet. */
const leaf = z.discriminatedUnion("type", [
  ...block.options,
  z.object({ type: z.literal("media") }),
  z.object({ type: z.literal("facts") }),
  z.object({ type: z.literal("empty") }),
]);
/** A tree of boxes: a box, or a split of boxes into columns or rows. src/lib/boxes.ts has the helpers. */
const box: z.ZodType<unknown> = z.lazy(() =>
  z.union([leaf, z.object({ split: z.enum(["columns", "rows"]), sizes: z.array(z.number()).optional(), children: z.array(box).min(1) })]),
);
/** Older files: a grid of columns x rows with cells. src/lib/legacy-project.ts converts them. */
const legacyGrid = z.object({}).passthrough();

const projects = defineCollection({
  loader: yml("projects"),
  schema: z.object({
    title: z.string(),
    topic: z.string(),
    summary: z.string().default(""),
    date: z.string().optional().default(""),
    cover: z.string().optional().default(""),
    coverSpacing: spacing,
    model: z.string().optional().default(""),
    youtube: z.string().optional().default(""),
    tools: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    // The page below the header: the main section and then the sections, each a tree of boxes.
    intro: z.string().optional(),
    main: z.union([box, legacyGrid]).optional(),
    sections: z.array(z.union([box, legacyGrid])).optional(),
    // Old files: one flat list of blocks. src/lib/project-model.ts converts it into sections when the page is drawn.
    blocks: z.array(z.any()).optional(),
    ...common,
  }),
});

const prints = defineCollection({
  loader: yml("prints"),
  schema: z.object({
    title: z.string(),
    photos: z.array(z.string()).default([]),
    category: z.string().default(""),
    material: z.string().default(""),
    printer: z.string().optional().default(""),
    printTime: z.string().optional().default(""),
    date: z.string().optional().default(""),
    note: z.string().optional().default(""),
    tools: z.array(z.string()).default([]),
    project: z.string().optional().default(""),
    ...common,
  }),
});

const work = defineCollection({
  loader: yml("work"),
  schema: z.object({
    title: z.string(),
    company: z.string(),
    link: z.string().optional().default(""),
    location: z.string().default(""),
    country: z.string().optional().default(""),
    period: z.string(),
    logo: z.string().optional().default(""),
    responsibilities: z.array(z.string()).default([]),
    tools: z.array(z.string()).default([]),
    papers: z.array(paper).default([]),
    ...common,
  }),
});

const education = defineCollection({
  loader: yml("education"),
  schema: z.object({
    degree: z.string(),
    institution: z.string(),
    period: z.string(),
    location: z.string().default(""),
    country: z.string().optional().default(""),
    link: z.string().optional().default(""),
    logo: z.string().optional().default(""),
    details: z.string().optional().default(""),
    papers: z.array(paper).default([]),
    tools: z.array(z.string()).default([]),
    ...common,
  }),
});

const experiences = defineCollection({
  loader: yml("experiences"),
  schema: z.object({
    type: z.string().default(""),
    title: z.string(),
    organization: z.string(),
    period: z.string(),
    link: z.string().optional().default(""),
    location: z.string().default(""),
    country: z.string().optional().default(""),
    logo: z.string().optional().default(""),
    description: z.array(z.string()).default([]),
    ...common,
  }),
});

const certifications = defineCollection({
  loader: yml("certifications"),
  schema: z.object({
    title: z.string(),
    issuer: z.string(),
    date: z.string().default(""),
    credentialId: z.string().optional().default(""),
    badge: z.string().optional().default(""),
    pdf: z.string().optional().default(""),
    verify: z.string().optional().default(""),
    tools: z.array(z.string()).default([]),
    ...common,
  }),
});

export const collections = { projects, prints, work, education, experiences, certifications };
