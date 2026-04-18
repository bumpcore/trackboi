<script setup lang="ts">
import { toRef } from "vue";
import { EditorContent } from "@tiptap/vue-3";
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
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import { useMarkdownEditor } from "@/ui/composables/useMarkdownEditor";
import { cn } from "@/ui/lib/utils";

const props = defineProps<{
	modelValue: string;
	placeholder?: string;
	class?: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
}>();

const {
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
} = useMarkdownEditor({
	modelValue: toRef(props, "modelValue"),
	onUpdate(value) {
		emit("update:modelValue", value);
	},
});
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
