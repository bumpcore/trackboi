<script setup lang="ts">
import Input from "@/ui/components/Input.vue";

export type BoardTableFilterKind = "search" | "select" | "number" | "date" | "checkbox";
export type BoardTableRangeFilter = { min?: string; max?: string };
export type BoardTableFilterValue = string | BoardTableRangeFilter | undefined;

const props = withDefaults(defineProps<{
	columnId: string;
	label: string;
	kind: BoardTableFilterKind;
	value: BoardTableFilterValue;
	options?: Array<{ value: string; label: string }>;
	compact?: boolean;
}>(), {
	options: () => [],
	compact: false,
});

const emit = defineEmits<{
	update: [columnId: string, value: BoardTableFilterValue];
}>();

function stringValue(): string {
	return typeof props.value === "string" ? props.value : "";
}

function rangeValue(): BoardTableRangeFilter {
	return props.value && typeof props.value === "object" && !Array.isArray(props.value) ? props.value : {};
}

function updateString(event: Event) {
	const target = event.target;
	if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
	emit("update", props.columnId, target.value || undefined);
}

function updateRange(key: keyof BoardTableRangeFilter, event: Event) {
	const target = event.target;
	if (!(target instanceof HTMLInputElement)) return;
	const next = {
		...rangeValue(),
		[key]: target.value || undefined,
	};
	if (!next.min && !next.max) {
		emit("update", props.columnId, undefined);
		return;
	}
	emit("update", props.columnId, next);
}
</script>

<template>
	<label class="grid min-w-0 gap-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground" :data-testid="`board-filter-${columnId}`">
		<span v-if="!compact" class="truncate">{{ label }}</span>
		<Input
			v-if="kind === 'search'"
			:model-value="stringValue()"
			:aria-label="label"
			:placeholder="compact ? label : 'Search'"
			class="h-7 rounded-none px-2 text-[11px] normal-case tracking-normal"
			@input="updateString"
		/>
		<select
			v-else-if="kind === 'select' || kind === 'checkbox'"
			:value="stringValue()"
			:aria-label="label"
			class="h-7 min-w-0 rounded-none border border-input bg-background/65 px-2 text-[11px] normal-case tracking-normal text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
			@change="updateString"
		>
			<option value="">Any</option>
			<option
				v-for="option in kind === 'checkbox' ? [{ value: 'true', label: 'Checked' }, { value: 'false', label: 'Unchecked' }] : options"
				:key="option.value"
				:value="option.value"
			>
				{{ option.label }}
			</option>
		</select>
		<div v-else class="grid min-w-0 grid-cols-2 gap-1">
			<Input
				:model-value="rangeValue().min ?? ''"
				:type="kind === 'date' ? 'date' : 'number'"
				:aria-label="`${label} minimum`"
				:placeholder="compact ? 'Min' : 'From'"
				class="h-7 rounded-none px-2 text-[11px] normal-case tracking-normal"
				@input="updateRange('min', $event)"
			/>
			<Input
				:model-value="rangeValue().max ?? ''"
				:type="kind === 'date' ? 'date' : 'number'"
				:aria-label="`${label} maximum`"
				:placeholder="compact ? 'Max' : 'To'"
				class="h-7 rounded-none px-2 text-[11px] normal-case tracking-normal"
				@input="updateRange('max', $event)"
			/>
		</div>
	</label>
</template>
