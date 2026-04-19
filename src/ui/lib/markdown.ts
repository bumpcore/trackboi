import MarkdownIt from "markdown-it";
import { createHighlighter } from "shiki";

const baseOptions = {
	html: false,
	linkify: true,
	typographer: false,
};

const inlineMarkdown = new MarkdownIt("zero", baseOptions)
	.enable(["text", "newline", "escape", "backticks", "emphasis", "link", "autolink", "entity"])
	.disable(["image"]);

const highlighter = await createHighlighter({
	themes: ["github-dark", "github-light"],
	langs: [
		"plaintext",
		"text",
		"ts",
		"tsx",
		"js",
		"jsx",
		"json",
		"bash",
		"shell",
		"sh",
		"html",
		"css",
		"vue",
		"md",
		"markdown",
		"yaml",
		"yml",
		"diff",
	],
});

const supportedLanguages = new Set(highlighter.getLoadedLanguages().map((language) => String(language)));

const blockMarkdown = new MarkdownIt("commonmark", {
	...baseOptions,
	highlight(code, language) {
		const normalizedLanguage = typeof language === "string" && supportedLanguages.has(language)
			? language
			: "plaintext";

		return highlighter.codeToHtml(code, {
			lang: normalizedLanguage,
			themes: {
				light: "github-light",
				dark: "github-dark",
			},
			defaultColor: false,
		});
	},
}).disable(["hr", "image", "html_block", "html_inline"]);

const cacheLimit = 500;
const inlineCache = new Map<string, string>();
const blockCache = new Map<string, string>();
const previewCache = new Map<string, string>();

export function renderInlineMarkdown(source: string): string {
	const normalized = source.replace(/\r?\n+/g, " ").trim();
	if (!normalized) return "";
	return renderWithCache(inlineCache, normalized, () => inlineMarkdown.renderInline(normalized));
}

export function renderMarkdownPreview(source: string): string {
	const normalized = normalizePreviewSource(source);
	if (!normalized) return "";
	return renderWithCache(previewCache, normalized, () => inlineMarkdown.renderInline(normalized));
}

export function renderMarkdown(source: string): string {
	const normalized = source.trim();
	if (!normalized) return "";
	return renderWithCache(blockCache, normalized, () => blockMarkdown.render(normalized));
}

function normalizePreviewSource(source: string): string {
	return source
		.trim()
		.replace(/```[\s\S]*?```/g, " [code] ")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/^\s{0,3}(#{1,6}|\>|\-|\*|\+|\d+\.)\s+/gm, "")
		.replace(/\r?\n+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 320);
}

function renderWithCache(cache: Map<string, string>, key: string, render: () => string): string {
	const cached = cache.get(key);
	if (cached != null) {
		cache.delete(key);
		cache.set(key, cached);
		return cached;
	}

	const html = render();
	cache.set(key, html);
	if (cache.size > cacheLimit) {
		const oldestKey = cache.keys().next().value;
		if (typeof oldestKey === "string") cache.delete(oldestKey);
	}
	return html;
}
