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
	themes: ["github-dark"],
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
			theme: "github-dark",
		});
	},
}).disable(["hr", "image", "html_block", "html_inline"]);

export function renderInlineMarkdown(source: string): string {
	const normalized = source.replace(/\r?\n+/g, " ").trim();
	if (!normalized) return "";
	return inlineMarkdown.renderInline(normalized);
}

export function renderMarkdown(source: string): string {
	const normalized = source.trim();
	if (!normalized) return "";
	return blockMarkdown.render(normalized);
}
