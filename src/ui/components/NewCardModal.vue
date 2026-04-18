<script setup lang="ts">
import { Plus, X } from "lucide-vue-next";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";
import MarkdownEditor from "@/ui/components/MarkdownEditor.vue";
import Select from "@/ui/components/Select.vue";
import type { SelectOption } from "@/ui/components/Select.vue";

defineProps<{
	open: boolean;
	busy: boolean;
	columnOptions: SelectOption[];
	trackOptions: SelectOption[];
	targetWorktreeOptions: SelectOption[];
}>();

defineEmits<{
	close: [];
	create: [];
}>();

const title = defineModel<string>("title", { required: true });
const description = defineModel<string>("description", { required: true });
const column = defineModel<string>("column", { required: true });
const trackId = defineModel<string>("trackId", { required: true });
const targetWorktreeId = defineModel<string>("targetWorktreeId", { required: true });
</script>

<template>
	<Transition name="surface">
		<div
			v-if="open"
			class="fixed inset-x-0 bottom-0 top-9 z-20 grid place-items-center bg-background/74 p-5 backdrop-blur-[6px]"
			@pointerdown.self="$emit('close')"
		>
			<aside
				class="modal-panel app-scroll grid max-h-[min(840px,calc(100vh-64px))] w-[min(780px,94vw)] content-start overflow-auto rounded-[18px] border border-border/75 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--card)/0.96)_100%)] shadow-[0_1px_0_hsl(0_0%_100%/0.04),0_26px_60px_hsl(0_0%_0%/0.42)]"
			>
				<header class="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/55 bg-card/96 px-6 py-5 backdrop-blur-md">
					<div class="min-w-0">
						<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/95">Create Card</p>
						<h2 class="mt-1 text-[22px] font-semibold tracking-tight text-foreground">New work item</h2>
						<p class="mt-1 text-sm text-muted-foreground">Capture the title first, then fill in placement and scope.</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						class="rounded-[10px] border border-transparent hover:border-border/60 hover:bg-background/70"
						type="button"
						@click="$emit('close')"
					>
						<X class="h-4 w-4" />
					</Button>
				</header>

				<form class="grid gap-6 px-6 py-6" @submit.prevent="$emit('create')">
					<section class="grid gap-4 rounded-[14px] border border-border/55 bg-background/22 p-4">
						<div>
						<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Summary</p>
						<p class="mt-1 text-sm text-muted-foreground">Make it short enough to scan in a board view.</p>
						</div>
						<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
							Title
							<Input
								v-model="title"
								autocomplete="off"
								autofocus
								placeholder="Ship the first slice"
								class="h-10 rounded-[10px] border-border/75 bg-background/62 px-3 text-[15px] font-medium"
							/>
						</label>
					</section>

					<section class="grid gap-4 rounded-[14px] border border-border/55 bg-background/22 p-4">
						<div>
							<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Details</p>
							<p class="mt-1 text-sm text-muted-foreground">Notes, context, plus checklist-worthy guidance.</p>
						</div>
						<div class="grid gap-1.5 text-xs font-medium text-muted-foreground">
							<span>Notes</span>
						<MarkdownEditor
							v-model="description"
							placeholder="Small enough to move today. Type / for quick commands."
						/>
					</div>
					</section>

					<section class="grid gap-4 rounded-[14px] border border-border/55 bg-background/22 p-4">
						<div>
							<p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/90">Placement</p>
							<p class="mt-1 text-sm text-muted-foreground">Choose where this card should appear and which track it belongs to, if relevant.</p>
						</div>
						<div class="grid gap-4 md:grid-cols-2">
							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Column
								<Select v-model="column" :options="columnOptions" />
							</label>

							<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
								Track
								<Select v-model="trackId" :options="trackOptions" />
							</label>
						</div>

						<label
							v-if="targetWorktreeOptions.length > 0"
							class="grid gap-1.5 text-xs font-medium text-muted-foreground"
						>
							Worktree
							<Select v-model="targetWorktreeId" :options="targetWorktreeOptions" />
						</label>
					</section>

					<div class="sticky bottom-0 flex gap-2 border-t border-border/55 bg-card/96 pt-4 backdrop-blur-md">
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
