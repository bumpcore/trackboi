import { describe, expect, test } from "bun:test";
import { renderInlineMarkdown, renderMarkdown, renderMarkdownPreview } from "../../src/ui/lib/markdown";

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
		expect(html).toContain('class="shiki shiki-themes github-light github-dark"');
		expect(html).toContain("--shiki-light");
		expect(html).toContain("--shiki-dark");
		expect(html).toContain("<pre");
		expect(html).toContain("<code>");
		expect(html).not.toContain("<script>");
	});

	test("renders cheap preview markdown without block wrappers or shiki output", () => {
		const html = renderMarkdownPreview("## Section\n\n- one\n- two\n\n```ts\nconst x = 1\n```");

		expect(html).toContain("Section");
		expect(html).toContain("one");
		expect(html).toContain("[code]");
		expect(html).not.toContain("<h2>");
		expect(html).not.toContain("shiki");
	});
});
