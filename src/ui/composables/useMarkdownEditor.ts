import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";
import type { Editor } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { useEditor } from "@tiptap/vue-3";
import { common, createLowlight } from "lowlight";

type SlashCommand = {
	id: string;
	label: string;
	aliases: string[];
	run: (editor: Editor) => void;
};

type MarkAction = "bold" | "italic" | "code";
type NodeAction = "bulletList" | "orderedList" | "blockquote" | "codeBlock";

/**
 * Encapsulates TipTap markdown editing state, slash commands, and toolbar
 * interactions so the Vue component can stay focused on layout and controls.
 */
export function useMarkdownEditor(options: {
	modelValue: Ref<string>;
	onUpdate(value: string): void;
}) {
	const slashQuery = ref("");
	const slashIndex = ref(0);
	const slashOpen = ref(false);
	const slashRange = ref<{ from: number; to: number } | null>(null);
	const linkMenuOpen = ref(false);
	const linkUrl = ref("");
	const lowlight = createLowlight(common);

	const slashCommands: SlashCommand[] = [
		{
			id: "heading-1",
			label: "Heading 1",
			aliases: ["h1", "title"],
			run: (editor) => {
				editor.chain().focus().toggleHeading({ level: 1 }).run();
			},
		},
		{
			id: "heading-2",
			label: "Heading 2",
			aliases: ["h2", "section"],
			run: (editor) => {
				editor.chain().focus().toggleHeading({ level: 2 }).run();
			},
		},
		{
			id: "heading-3",
			label: "Heading 3",
			aliases: ["h3", "subsection"],
			run: (editor) => {
				editor.chain().focus().toggleHeading({ level: 3 }).run();
			},
		},
		{
			id: "bold",
			label: "Bold",
			aliases: ["strong", "emphasis"],
			run: (editor) => {
				editor.chain().focus().toggleBold().run();
			},
		},
		{
			id: "italic",
			label: "Italic",
			aliases: ["em"],
			run: (editor) => {
				editor.chain().focus().toggleItalic().run();
			},
		},
		{
			id: "code",
			label: "Inline code",
			aliases: ["inline", "backtick"],
			run: (editor) => {
				editor.chain().focus().toggleCode().run();
			},
		},
		{
			id: "bullet-list",
			label: "Bullet list",
			aliases: ["ul", "list"],
			run: (editor) => {
				editor.chain().focus().toggleBulletList().run();
			},
		},
		{
			id: "ordered-list",
			label: "Ordered list",
			aliases: ["ol", "numbered"],
			run: (editor) => {
				editor.chain().focus().toggleOrderedList().run();
			},
		},
		{
			id: "blockquote",
			label: "Blockquote",
			aliases: ["quote"],
			run: (editor) => {
				editor.chain().focus().toggleBlockquote().run();
			},
		},
		{
			id: "code-block",
			label: "Code block",
			aliases: ["fence", "pre"],
			run: (editor) => {
				editor.chain().focus().toggleCodeBlock().run();
			},
		},
	];

	const filteredSlashCommands = computed(() => {
		const query = slashQuery.value.trim().toLowerCase();
		if (!query) return slashCommands;
		return slashCommands.filter((command) => (
			command.label.toLowerCase().includes(query) ||
			command.aliases.some((alias) => alias.includes(query))
		));
	});

	const editor = useEditor({
		content: options.modelValue.value,
		contentType: "markdown",
		editorProps: {
			handleKeyDown(_, event) {
				const editorInstance = editor.value;
				if (editorInstance && (event.key === " " || event.key === "Enter")) {
					if (runMarkdownShortcut(editorInstance, event.key)) {
						event.preventDefault();
						return true;
					}
				}

				if (!slashOpen.value) return false;

				if (event.key === "ArrowDown") {
					event.preventDefault();
					slashIndex.value = filteredSlashCommands.value.length === 0
						? 0
						: (slashIndex.value + 1) % filteredSlashCommands.value.length;
					return true;
				}

				if (event.key === "ArrowUp") {
					event.preventDefault();
					slashIndex.value = filteredSlashCommands.value.length === 0
						? 0
						: (slashIndex.value - 1 + filteredSlashCommands.value.length) % filteredSlashCommands.value.length;
					return true;
				}

				if (event.key === "Enter" || event.key === "Tab") {
					const command = filteredSlashCommands.value[slashIndex.value];
					if (!command) return false;
					event.preventDefault();
					runSlashCommand(command);
					return true;
				}

				if (event.key === "Escape") {
					event.preventDefault();
					closeSlashMenu();
					return true;
				}

				return false;
			},
		},
		extensions: [
			StarterKit.configure({
				horizontalRule: false,
				strike: false,
				codeBlock: false,
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
			CodeBlockLowlight.configure({
				lowlight,
				defaultLanguage: "plaintext",
			}),
			Markdown.configure({
				markedOptions: {
					gfm: true,
					breaks: false,
				},
			}),
		],
		onCreate({ editor: editorInstance }) {
			refreshSlashState(editorInstance);
		},
		onSelectionUpdate({ editor: editorInstance }) {
			refreshSlashState(editorInstance);
		},
		onUpdate({ editor: editorInstance }) {
			options.onUpdate(editorInstance.getMarkdown());
			refreshSlashState(editorInstance);
		},
	});

	watch(
		() => options.modelValue.value,
		(value) => {
			const editorInstance = editor.value;
			if (!editorInstance) return;
			if (value === editorInstance.getMarkdown()) return;
			editorInstance.commands.setContent(value, { contentType: "markdown" });
			refreshSlashState(editorInstance);
		},
	);

	onBeforeUnmount(() => {
		editor.value?.destroy();
	});

	const canSetLink = computed(() => {
		const editorInstance = editor.value;
		if (!editorInstance) return false;
		if (editorInstance.isActive("link")) return true;
		return !editorInstance.state.selection.empty;
	});

	const showPlaceholder = computed(() => {
		const editorInstance = editor.value;
		if (!editorInstance) return options.modelValue.value.trim().length === 0;
		return editorInstance.getText().trim().length === 0 && !slashOpen.value;
	});

	function closeSlashMenu() {
		slashOpen.value = false;
		slashQuery.value = "";
		slashIndex.value = 0;
		slashRange.value = null;
	}

	function refreshSlashState(editorInstance: Editor) {
		const { from, empty } = editorInstance.state.selection;
		if (!empty) {
			closeSlashMenu();
			return;
		}

		const { $from } = editorInstance.state.selection;
		const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
		const trimmed = textBefore.trimStart();
		const leadingWhitespace = textBefore.length - trimmed.length;
		const match = /^\/([a-z-]*)$/.exec(trimmed);

		if (!match) {
			closeSlashMenu();
			return;
		}

		slashOpen.value = true;
		slashQuery.value = match[1] ?? "";
		slashIndex.value = 0;
		slashRange.value = {
			from: from - trimmed.length,
			to: from,
		};

		if (leadingWhitespace > 0) {
			slashRange.value.from += leadingWhitespace;
		}
	}

	function runSlashCommand(command: SlashCommand) {
		const editorInstance = editor.value;
		if (!editorInstance || !slashRange.value) return;
		editorInstance.chain().focus().deleteRange(slashRange.value).run();
		command.run(editorInstance);
		closeSlashMenu();
	}

	function toggleMark(action: MarkAction) {
		const editorInstance = editor.value;
		if (!editorInstance) return;

		const chain = editorInstance.chain().focus();
		if (action === "bold") chain.toggleBold().run();
		if (action === "italic") chain.toggleItalic().run();
		if (action === "code") chain.toggleCode().run();
	}

	function toggleHeading(level: 1 | 2 | 3) {
		const editorInstance = editor.value;
		if (!editorInstance) return;
		editorInstance.chain().focus().toggleHeading({ level }).run();
	}

	function toggleNode(action: NodeAction) {
		const editorInstance = editor.value;
		if (!editorInstance) return;

		const chain = editorInstance.chain().focus();
		if (action === "bulletList") chain.toggleBulletList().run();
		if (action === "orderedList") chain.toggleOrderedList().run();
		if (action === "blockquote") chain.toggleBlockquote().run();
		if (action === "codeBlock") chain.toggleCodeBlock().run();
	}

	function stopToolbarFocus(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
	}

	function openLinkMenu() {
		const editorInstance = editor.value;
		if (!editorInstance || !canSetLink.value) return;
		linkMenuOpen.value = true;
		linkUrl.value = editorInstance.getAttributes("link").href ?? "";
	}

	function closeLinkMenu() {
		linkMenuOpen.value = false;
		linkUrl.value = "";
	}

	function applyLink() {
		const editorInstance = editor.value;
		if (!editorInstance) return;
		const href = linkUrl.value.trim();
		if (!href) {
			editorInstance.chain().focus().extendMarkRange("link").unsetLink().run();
			closeLinkMenu();
			return;
		}
		editorInstance.chain().focus().extendMarkRange("link").setLink({ href }).run();
		closeLinkMenu();
	}

	function handleHeadingMouseDown(event: MouseEvent, level: 1 | 2 | 3) {
		stopToolbarFocus(event);
		toggleHeading(level);
	}

	function handleMarkMouseDown(event: MouseEvent, action: MarkAction) {
		stopToolbarFocus(event);
		toggleMark(action);
	}

	function handleNodeMouseDown(event: MouseEvent, action: NodeAction) {
		stopToolbarFocus(event);
		toggleNode(action);
	}

	function handleLinkMouseDown(event: MouseEvent) {
		stopToolbarFocus(event);
		openLinkMenu();
	}

	function handleSlashCommandMouseDown(event: MouseEvent, command: SlashCommand) {
		stopToolbarFocus(event);
		runSlashCommand(command);
	}

	return {
		editor,
		filteredSlashCommands,
		slashOpen,
		slashIndex,
		linkMenuOpen,
		linkUrl,
		showPlaceholder,
		canSetLink,
		applyLink,
		closeLinkMenu,
		handleHeadingMouseDown,
		handleLinkMouseDown,
		handleMarkMouseDown,
		handleNodeMouseDown,
		handleSlashCommandMouseDown,
	};
}

function runMarkdownShortcut(editorInstance: Editor, key: string): boolean {
	const { empty, from } = editorInstance.state.selection;
	if (!empty) return false;

	const { $from } = editorInstance.state.selection;
	const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
	const trimmed = textBefore.trimStart();
	const leadingWhitespace = textBefore.length - trimmed.length;
	const markerRange = {
		from: from - textBefore.length + leadingWhitespace,
		to: from,
	};

	if (key === " ") {
		const headingMatch = /^(#{1,3})$/.exec(trimmed);
		if (headingMatch) {
			editorInstance
				.chain()
				.focus()
				.deleteRange(markerRange)
				.setHeading({ level: headingMatch[1].length as 1 | 2 | 3 })
				.run();
			return true;
		}

		if (/^[-+*]$/.test(trimmed)) {
			editorInstance.chain().focus().deleteRange(markerRange).toggleBulletList().run();
			return true;
		}

		if (/^1\.$/.test(trimmed)) {
			editorInstance.chain().focus().deleteRange(markerRange).toggleOrderedList().run();
			return true;
		}

		if (/^>$/.test(trimmed)) {
			editorInstance.chain().focus().deleteRange(markerRange).toggleBlockquote().run();
			return true;
		}
	}

	if (key === "Enter") {
		const codeFenceMatch = /^```([a-z0-9_-]+)?$/i.exec(trimmed);
		if (codeFenceMatch) {
			editorInstance
				.chain()
				.focus()
				.deleteRange(markerRange)
				.setCodeBlock(codeFenceMatch[1] ? { language: codeFenceMatch[1] } : undefined)
				.run();
			return true;
		}
	}

	return false;
}
