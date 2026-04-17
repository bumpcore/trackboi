<script setup lang="ts">
import { Plus, X } from "lucide-vue-next";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import MarkdownEditor from "@/ui/components/MarkdownEditor.vue";
import Select from "@/ui/components/Select.vue";
import type { SelectOption } from "@/ui/components/Select.vue";
import type { ScopeMode } from "@/ui/viewTypes";

defineProps<{
	open: boolean;
	busy: boolean;
	columnOptions: SelectOption[];
	scopeOptions: SelectOption[];
	targetWorktreeOptions: SelectOption[];
}>();

defineEmits<{
	close: [];
	create: [];
}>();

const title = defineModel<string>("title", { required: true });
const description = defineModel<string>("description", { required: true });
const column = defineModel<string>("column", { required: true });
const scopeMode = defineModel<ScopeMode>("scopeMode", { required: true });
const targetWorktreeId = defineModel<string>("targetWorktreeId", { required: true });
</script>

<template>
	<Transition name="surface">
		<div
			v-if="open"
			class="fixed inset-x-0 bottom-0 top-9 z-20 grid place-items-center bg-background/65 p-5 backdrop-blur-[2px]"
			@pointerdown.self="$emit('close')"
		>
			<aside
				class="modal-panel app-scroll grid max-h-[min(820px,calc(100vh-72px))] w-[min(680px,94vw)] content-start gap-4 overflow-auto rounded-lg border border-border bg-card p-5 shadow-2xl"
			>
				<header class="flex items-start justify-between gap-3">
					<div>
						<p class="text-xs font-semibold uppercase text-primary">New card</p>
						<h2 class="mt-1 text-lg font-semibold">Card details</h2>
					</div>
					<Button variant="ghost" size="icon" type="button" @click="$emit('close')">
						<X class="h-4 w-4" />
					</Button>
				</header>

				<form class="grid gap-4" @submit.prevent="$emit('create')">
					<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Title
						<Input v-model="title" autocomplete="off" autofocus placeholder="Ship the first slice" />
					</label>

					<div class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						<span>Notes</span>
						<MarkdownEditor
							v-model="description"
							placeholder="Small enough to move today. Type / for quick commands."
						/>
					</div>

					<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Column
						<Select v-model="column" :options="columnOptions" />
					</label>

					<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Scope
						<Select v-model="scopeMode" :options="scopeOptions" />
					</label>

					<label v-if="targetWorktreeOptions.length > 0" class="grid gap-1.5 text-xs font-medium text-muted-foreground">
						Worktree
						<Select v-model="targetWorktreeId" :options="targetWorktreeOptions" />
					</label>

					<div class="flex gap-2">
						<Button type="submit" :disabled="busy || !title.trim()">
							<Plus class="h-4 w-4" />
							Add card
						</Button>
						<Button variant="outline" type="button" :disabled="busy" @click="$emit('close')">
							Cancel
						</Button>
					</div>
				</form>
			</aside>
		</div>
	</Transition>
</template>
