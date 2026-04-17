<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { Editor } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import {
	Bold,
	Code,
	Heading1,
	Heading2,
	Heading3,
	Italic,
	Link2,
	List,
	ListOrdered,
	Quote,
	SquareTerminal,
} from "lucide-vue-next";
import { common, createLowlight } from "lowlight";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import { cn } from "@/ui/lib/utils";

const props = defineProps<{
	modelValue: string;
	placeholder?: string;
	class?: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
}>();

type SlashCommand = {
	id: string;
	label: string;
	aliases: string[];
	run: (editor: Editor) => void;
};

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

const showPlaceholder = computed(() => {
	const editorInstance = editor.value;
	if (!editorInstance) return props.modelValue.trim().length === 0;
	return editorInstance.getText().trim().length === 0 && !slashOpen.value;
});

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

const editor = useEditor({
	content: props.modelValue,
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
		emit("update:modelValue", editorInstance.getMarkdown());
		refreshSlashState(editorInstance);
	},
});

watch(
	() => props.modelValue,
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

function toggleMark(action: "bold" | "italic" | "code") {
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

function toggleNode(action: "bulletList" | "orderedList" | "blockquote" | "codeBlock") {
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

function handleMarkMouseDown(event: MouseEvent, action: "bold" | "italic" | "code") {
	stopToolbarFocus(event);
	toggleMark(action);
}

function handleNodeMouseDown(event: MouseEvent, action: "bulletList" | "orderedList" | "blockquote" | "codeBlock") {
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
</script>

<template>
	<div :class="cn('grid gap-2', props.class)">
		<div class="flex flex-wrap items-center gap-1.5 rounded-md border border-border/45 bg-background/32 p-1.5">
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:class="editor?.isActive('heading', { level: 1 }) ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleHeadingMouseDown($event, 1)"
			>
				<Heading1 class="h-3.5 w-3.5" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:class="editor?.isActive('heading', { level: 2 }) ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleHeadingMouseDown($event, 2)"
			>
				<Heading2 class="h-3.5 w-3.5" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:class="editor?.isActive('heading', { level: 3 }) ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleHeadingMouseDown($event, 3)"
			>
				<Heading3 class="h-3.5 w-3.5" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:class="editor?.isActive('bold') ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleMarkMouseDown($event, 'bold')"
			>
				<Bold class="h-3.5 w-3.5" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:class="editor?.isActive('italic') ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleMarkMouseDown($event, 'italic')"
			>
				<Italic class="h-3.5 w-3.5" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:class="editor?.isActive('code') ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleMarkMouseDown($event, 'code')"
			>
				<Code class="h-3.5 w-3.5" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:class="editor?.isActive('bulletList') ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleNodeMouseDown($event, 'bulletList')"
			>
				<List class="h-3.5 w-3.5" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:class="editor?.isActive('orderedList') ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleNodeMouseDown($event, 'orderedList')"
			>
				<ListOrdered class="h-3.5 w-3.5" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:class="editor?.isActive('blockquote') ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleNodeMouseDown($event, 'blockquote')"
			>
				<Quote class="h-3.5 w-3.5" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:class="editor?.isActive('codeBlock') ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleNodeMouseDown($event, 'codeBlock')"
			>
				<SquareTerminal class="h-3.5 w-3.5" />
			</Button>
			<Button
				size="sm"
				variant="ghost"
				type="button"
				:disabled="!canSetLink"
				:class="editor?.isActive('link') ? 'bg-card/70 text-foreground' : ''"
				@mousedown="handleLinkMouseDown"
			>
				<Link2 class="h-3.5 w-3.5" />
			</Button>
		</div>

		<div v-if="linkMenuOpen" class="flex flex-wrap items-center gap-2 rounded-md bg-background/24 px-1 py-1.5">
			<Input v-model="linkUrl" class="min-w-[220px] flex-1" autocomplete="off" placeholder="https://example.com" />
			<Button size="sm" type="button" @click="applyLink">Apply link</Button>
			<Button size="sm" variant="outline" type="button" @click="closeLinkMenu">Cancel</Button>
		</div>

		<div class="relative rounded-md border border-input/70 bg-background/35">
			<EditorContent :editor="editor" class="note-editor min-h-40 px-3 py-2 text-sm text-foreground" />
			<p
				v-if="showPlaceholder"
				class="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground/70"
			>
				{{ props.placeholder ?? "Write notes, use markdown, or type / for commands." }}
			</p>
		</div>

		<div
			v-if="slashOpen && filteredSlashCommands.length > 0"
			class="grid gap-1 rounded-md border border-border/50 bg-background/28 p-1.5"
		>
			<div class="px-1 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
				Slash commands
			</div>
			<div class="grid gap-1">
				<button
					v-for="(command, index) in filteredSlashCommands"
					:key="command.id"
					class="rounded-md px-2 py-1.5 text-left text-sm transition-colors"
					:class="index === slashIndex ? 'bg-accent/70 text-foreground' : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'"
					type="button"
					@mousedown="handleSlashCommandMouseDown($event, command)"
				>
					{{ command.label }}
				</button>
			</div>
		</div>
	</div>
</template>
