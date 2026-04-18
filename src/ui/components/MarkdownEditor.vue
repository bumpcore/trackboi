<script setup lang="ts">
import { computed, ref } from "vue";
import { Columns2, Eye, Pencil } from "lucide-vue-next";
import MarkdownContent from "@/ui/components/MarkdownContent.vue";
import { cn } from "@/ui/lib/utils";

type EditorMode = "edit" | "preview" | "split";

const props = defineProps<{
	modelValue: string;
	placeholder?: string;
	class?: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: string];
}>();

const mode = ref<EditorMode>("edit");

const modes: Array<{ id: EditorMode; label: string; icon: typeof Pencil }> = [
	{ id: "edit", label: "Edit", icon: Pencil },
	{ id: "preview", label: "Preview", icon: Eye },
	{ id: "split", label: "Split", icon: Columns2 },
];

const showEditor = computed(() => mode.value === "edit" || mode.value === "split");
const showPreview = computed(() => mode.value === "preview" || mode.value === "split");
const previewEmpty = computed(() => props.modelValue.trim().length === 0);

function updateValue(event: Event) {
	const target = event.target as HTMLTextAreaElement | null;
	emit("update:modelValue", target?.value ?? "");
}
</script>

<template>
	<div :class="cn('grid gap-2', props.class)">
		<div class="flex items-center justify-between gap-3 rounded-md border border-border/55 bg-background/28 p-1.5">
			<div class="flex items-center gap-1">
				<button
					v-for="item in modes"
					:key="item.id"
					type="button"
					class="shell-tab-button h-8"
					:class="{ 'is-active': mode === item.id }"
					@click="mode = item.id"
				>
					<component :is="item.icon" class="h-3.5 w-3.5" />
					{{ item.label }}
				</button>
			</div>
			<div class="font-mono text-[10px] text-muted-foreground">Markdown</div>
		</div>

		<div
			class="note-editor-grid rounded-md border border-input/70 bg-background/35"
			:class="mode === 'split' ? 'grid-cols-2' : 'grid-cols-1'"
		>
			<div
				v-if="showEditor"
				class="min-w-0"
				:class="showPreview ? 'border-r border-border/60' : ''"
			>
				<textarea
					:value="modelValue"
					class="note-editor-textarea app-scroll min-h-40 w-full resize-y bg-transparent px-3 py-2 text-sm text-foreground outline-none"
					:placeholder="props.placeholder ?? 'Write markdown notes.'"
					spellcheck="false"
					@input="updateValue"
				/>
			</div>

			<div v-if="showPreview" class="min-w-0">
				<div v-if="previewEmpty" class="grid min-h-40 place-items-center px-3 py-2 text-sm text-muted-foreground">
					Preview will appear here.
				</div>
				<MarkdownContent
					v-else
					:value="modelValue"
					class="note-editor-preview app-scroll min-h-40 px-3 py-2 text-sm text-foreground"
				/>
			</div>
		</div>
	</div>
</template>
