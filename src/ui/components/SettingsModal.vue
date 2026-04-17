<script setup lang="ts">
import { ref, watch } from "vue";
import { ListPlus, RotateCcw, Search, Trash2, X } from "lucide-vue-next";
import Button from "@/ui/components/Button.vue";
import Input from "@/ui/components/Input.vue";

const props = defineProps<{
	open: boolean;
	paths: string[];
	busy: boolean;
}>();

const draft = defineModel<string>("draft", { required: true });

const emit = defineEmits<{
	close: [];
	add: [];
	remove: [path: string];
	reset: [];
}>();

type SettingsSection = "storage";

const activeSection = ref<SettingsSection>("storage");

watch(
	() => props.open,
	(open) => {
		if (open) {
			activeSection.value = "storage";
		}
	},
);
</script>

<template>
	<Transition name="surface">
		<div
			v-if="open"
			class="fixed inset-x-0 bottom-0 top-9 z-30 grid place-items-center bg-background/65 p-5 backdrop-blur-[2px]"
			@pointerdown.self="emit('close')"
		>
			<aside
				class="modal-panel grid h-[min(760px,calc(100vh-72px))] w-[min(860px,96vw)] grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl"
			>
				<div class="grid content-start border-r border-border/35 bg-background/32 p-4">
					<div class="grid gap-6">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-primary">Trackboi</p>
							<h2 class="mt-1 text-lg font-semibold tracking-tight">App settings</h2>
						</div>

						<div class="grid gap-4">
							<div>
								<p class="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Storage</p>
								<button
									type="button"
									class="mt-2 flex w-full items-center gap-2 rounded-md bg-card/55 px-3 py-2 text-left text-sm font-medium text-foreground"
									@click="activeSection = 'storage'"
								>
									<Search class="h-4 w-4 text-muted-foreground" />
									Storage lookup
								</button>
							</div>
						</div>
					</div>
				</div>

				<div class="app-scroll grid content-start gap-6 overflow-y-auto p-6">
					<header class="flex items-start justify-between gap-3 border-b border-border/30 pb-5">
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-primary">General</p>
							<h2 class="mt-1 text-xl font-semibold tracking-tight">Storage lookup</h2>
							<p class="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
								Trackboi searches these repo-relative locations in order and opens the first store it finds.
							</p>
						</div>
						<Button variant="ghost" size="icon" type="button" @click="emit('close')">
							<X class="h-4 w-4" />
						</Button>
					</header>

					<section v-if="activeSection === 'storage'" class="grid gap-4">
						<section class="grid gap-1 overflow-hidden rounded-lg bg-background/12">
							<div class="border-b border-border/60 px-4 py-3">
								<h3 class="text-sm font-semibold text-foreground">Search order</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Earlier paths win. If a repo contains more than one Trackboi store, the first matching path becomes the active database.
								</p>
							</div>

							<div class="grid gap-0">
								<div
									v-for="(path, index) in paths"
									:key="path"
									class="flex items-center justify-between gap-3 border-b border-border/35 px-4 py-3 last:border-b-0"
								>
									<div class="min-w-0">
										<p class="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
											{{ index + 1 }} priority
										</p>
										<p class="mt-1 truncate font-mono text-sm text-foreground">{{ path }}</p>
									</div>
									<Button variant="ghost" size="icon" type="button" :disabled="busy" @click="emit('remove', path)">
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</div>
						</section>

						<section class="grid gap-4 rounded-lg bg-background/12 p-4">
							<div>
								<h3 class="text-sm font-semibold text-foreground">Add location</h3>
								<p class="mt-1 text-sm leading-6 text-muted-foreground">
									Use repo-relative paths only. Keep them narrow and predictable so Trackboi stays easy to reason about.
								</p>
							</div>

							<form class="grid gap-3" @submit.prevent="emit('add')">
								<label class="grid gap-1.5 text-xs font-medium text-muted-foreground">
									Storage path
									<Input v-model="draft" autocomplete="off" placeholder=".etc/.trackboi" />
								</label>
								<div class="flex flex-wrap gap-2">
									<Button type="submit" :disabled="busy || !draft.trim()">
										<ListPlus class="h-4 w-4" />
										Add path
									</Button>
									<Button variant="outline" type="button" :disabled="busy" @click="emit('reset')">
										<RotateCcw class="h-4 w-4" />
										Restore defaults
									</Button>
								</div>
							</form>
						</section>
					</section>
				</div>
			</aside>
		</div>
	</Transition>
</template>
