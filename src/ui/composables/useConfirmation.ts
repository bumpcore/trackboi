import { computed, ref } from "vue";
import type { Confirmation } from "@/ui/viewTypes";

export function useConfirmation() {
	const confirmation = ref<Confirmation | null>(null);

	const confirmDialogOpen = computed({
		get: () => confirmation.value != null,
		set: (open) => {
			if (!open) confirmation.value = null;
		},
	});

	function requestConfirmation(nextConfirmation: Confirmation) {
		confirmation.value = nextConfirmation;
	}

	function confirmAction() {
		const action = confirmation.value?.onConfirm;
		confirmation.value = null;
		void action?.();
	}

	return {
		confirmation,
		confirmAction,
		confirmDialogOpen,
		requestConfirmation,
	};
}
