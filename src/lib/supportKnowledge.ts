import { readFile } from "fs/promises";
import path from "path";
import { cache } from "react";

type KnowledgeSection = {
    heading: string;
    content: string;
};

const SUPPORT_LINKS = {
    whatsapp: "https://wa.me/64275665850",
    messenger: "https://m.me/indijanmac",
};

const readKnowledgeFile = cache(async () => {
    const filePath = path.join(process.cwd(), "src/content/rentapp-support.md");
    return readFile(filePath, "utf8");
});

function splitSections(markdown: string): KnowledgeSection[] {
    const blocks = markdown.split(/\n##\s+/);
    return blocks
        .map((block, index) => {
            const normalized = index === 0 ? block.replace(/^#\s+.+\n*/, "").trim() : block.trim();
            if (!normalized) return null;

            const [headingLine, ...rest] = normalized.split("\n");
            return {
                heading: headingLine.trim(),
                content: rest.join("\n").trim(),
            };
        })
        .filter((section): section is KnowledgeSection => Boolean(section?.heading && section.content));
}

function normalize(text: string) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(text: string) {
    return normalize(text)
        .split(" ")
        .filter((token) => token.length > 2);
}

function scoreSection(queryTokens: string[], section: KnowledgeSection) {
    const haystack = `${section.heading}\n${section.content}`;
    const normalized = normalize(haystack);
    let score = 0;

    for (const token of queryTokens) {
        if (normalized.includes(token)) score += 2;
    }

    if (normalize(section.heading).includes(queryTokens.join(" "))) {
        score += 6;
    }

    return score;
}

export async function buildSupportContext(question: string) {
    const markdown = await readKnowledgeFile();
    const sections = splitSections(markdown);
    const tokens = tokenize(question);

    const ranked = sections
        .map((section) => ({ section, score: scoreSection(tokens, section) }))
        .sort((a, b) => b.score - a.score);

    const topSections = ranked
        .filter((item, index) => item.score > 0 || index < 4)
        .slice(0, 6)
        .map(({ section }) => `## ${section.heading}\n${section.content}`)
        .join("\n\n");

    return {
        fullKnowledge: markdown,
        context: topSections || markdown,
        links: SUPPORT_LINKS,
    };
}

export function getSupportLinks() {
    return SUPPORT_LINKS;
}
