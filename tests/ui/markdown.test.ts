import { afterEach, describe, expect, test } from "bun:test";
import { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { renderInlineMarkdown, renderMarkdown } from "../../src/ui/lib/markdown";

const editors: Editor[] = [];

afterEach(() => {
	for (const editor of editors.splice(0)) {
		editor.destroy();
	}
});

describe("markdown rendering", () => {
	test("renders inline markdown for titles without block output or raw html", () => {
		const html = renderInlineMarkdown("# Hello **world** `code` <script>alert(1)</script> [docs](https://example.com)");

		expect(html).toContain("<strong>world</strong>");
		expect(html).toContain("<code>code</code>");
		expect(html).toContain('<a href="https://example.com">docs</a>');
		expect(html).not.toContain("<h1>");
		expect(html).not.toContain("<script>");
	});

	test("renders note markdown with basic blocks and no raw html", () => {
		const html = renderMarkdown("## Section\n\n- one\n- two\n\n> quote\n\n```ts\nconst x = 1\n```\n\n<script>alert(1)</script>");

		expect(html).toContain("<h2>Section</h2>");
		expect(html).toContain("<ul>");
		expect(html).toContain("<blockquote>");
		expect(html).toContain('class="shiki github-dark"');
		expect(html).toContain("<pre");
		expect(html).toContain("<code>");
		expect(html).not.toContain("<script>");
	});
});

describe("markdown editor round-trip", () => {
	test("round-trips supported markdown through tiptap", () => {
		const editor = new Editor({
			content: "## Section\n\n**Bold**\n\n- one\n- two\n\n> quote\n\n```ts\nconst x = 1\n```",
			contentType: "markdown",
			extensions: [
				StarterKit.configure({
					horizontalRule: false,
					strike: false,
					heading: {
						levels: [1, 2, 3],
					},
					link: {
						autolink: true,
						linkOnPaste: true,
						openOnClick: false,
						defaultProtocol: "https",
					},
				}),
				Markdown.configure({
					markedOptions: {
						gfm: true,
						breaks: false,
					},
				}),
			],
		});

		editors.push(editor);

		const markdown = editor.getMarkdown();

		expect(markdown).toContain("## Section");
		expect(markdown).toContain("**Bold**");
		expect(markdown).toContain("- one");
		expect(markdown).toContain("> quote");
		expect(markdown).toContain("```ts");
	});
});
