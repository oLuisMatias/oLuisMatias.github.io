import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const yml = (dir: string) => glob({ pattern: "**/*.{yml,yaml}", base: `./src/content/${dir}` });

const common = {
  visible: z.boolean().default(true),
  order: z.number().default(100),
};
const paper = z.object({ title: z.string(), url: z.string().optional().default("") });
/** Sides of an image that get empty space around it (5% of the frame width each). */
const spacing = z.array(z.enum(["top", "right", "bottom", "left"])).default([]);

const block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().default("") }),
  z.object({
    type: z.literal("image"),
    src: z.string(),
    alt: z.string().optional().default(""),
    caption: z.string().optional().default(""),
    position: z.enum(["left", "right", "center", "full"]).default("full"),
    spacing,
  }),
  z.object({
    type: z.literal("gallery"),
    images: z.array(z.object({ src: z.string(), caption: z.string().optional().default("") })).default([]),
  }),
  z.object({ type: z.literal("model"), src: z.string(), caption: z.string().optional().default("") }),
  z.object({ type: z.literal("youtube"), url: z.string() }),
  z.object({ type: z.literal("divider") }),
]);

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
    blocks: z.array(block).default([]),
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
