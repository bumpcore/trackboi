<script setup lang="ts">
import type { Column } from "@/core/types";
import Badge from "@/ui/components/Badge.vue";
import Input from "@/ui/components/Input.vue";
import Select, { type SelectOption } from "@/ui/components/Select.vue";

defineProps<{
	busy: boolean;
	mode: "create" | "edit";
	column: Column | null;
	cardCount: number;
	insertAfterOptions: SelectOption[];
}>();

const name = defineModel<string>("name", { required: true });
const insertAfter = defineModel<string>("insertAfter", { required: true });
</script>

<template>
	<div class="grid content-start gap-4">
		<section class="shell-section">
			<div>
				<p class="shell-section-title">{{ mode === "create" ? "New column" : "Column settings" }}</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Name the workflow step and place it exactly where it belongs on the board.
				</p>
			</div>

			<div class="grid gap-3">
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Name
					<Input v-model="name" autocomplete="off" :disabled="busy" />
				</label>
				<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
					Insert after
					<Select v-model="insertAfter" :options="insertAfterOptions" :disabled="busy" />
				</label>
			</div>
		</section>

		<section v-if="mode === 'edit' && column" class="shell-section">
			<div class="flex items-center justify-between gap-3">
				<div>
					<p class="shell-section-title">Current column</p>
					<p class="mt-1 text-sm text-muted-foreground">This edits the live board structure for the active board.</p>
				</div>
				<Badge variant="outline">{{ cardCount }} cards</Badge>
			</div>

			<div class="rounded-md border border-border/80 bg-secondary/55 px-3 py-3">
				<div class="text-sm font-medium text-foreground">{{ column.name }}</div>
				<div class="mt-1 trackboi-mono-font text-[11px] text-muted-foreground">{{ column.id }}</div>
			</div>
		</section>
	</div>
</template>
