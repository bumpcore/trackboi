import { desktop } from "@/electron/renderer";
import type { ResizeEdge } from "@/ui/viewTypes";

const resizeEdges: ResizeEdge[] = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];

function isWindowControlEvent(event: Event) {
	const target = event.target;
	return target instanceof HTMLElement && target.closest("[data-window-control]") != null;
}

function resizeCursor(edge: ResizeEdge) {
	if (edge === "n" || edge === "s") return "ns-resize";
	if (edge === "e" || edge === "w") return "ew-resize";
	if (edge === "ne" || edge === "sw") return "nesw-resize";
	return "nwse-resize";
}

function resizeHandleClass(edge: ResizeEdge) {
	const base = "fixed z-50";
	const classes: Record<ResizeEdge, string> = {
		n: "left-3 right-3 top-0 h-2",
		e: "right-0 top-3 bottom-3 w-2",
		s: "left-3 right-3 bottom-0 h-2",
		w: "left-0 top-3 bottom-3 w-2",
		ne: "right-0 top-0 h-4 w-4",
		nw: "left-0 top-0 h-4 w-4",
		se: "right-0 bottom-0 h-4 w-4",
		sw: "left-0 bottom-0 h-4 w-4",
	};

	return `${base} ${classes[edge]}`;
}

export function useWindowChrome() {
	async function minimizeWindow() {
		await desktop.minimizeWindow();
	}

	async function closeWindow() {
		await desktop.closeWindow();
	}

	async function toggleMaximizeWindow() {
		await desktop.toggleMaximizeWindow();
	}

	async function handleTitlebarDoubleClick(event: MouseEvent) {
		if (isWindowControlEvent(event)) return;
		await toggleMaximizeWindow();
	}

	function startTitlebarDrag(event: PointerEvent) {
		if (event.button !== 0 || event.detail > 1 || isWindowControlEvent(event)) return;
		event.preventDefault();
		void desktop.startWindowDrag();
	}

	async function startResize(edge: ResizeEdge, event: PointerEvent) {
		event.preventDefault();
		await desktop.startResize(edge);
	}

	return {
		closeWindow,
		handleTitlebarDoubleClick,
		minimizeWindow,
		resizeCursor,
		resizeEdges,
		resizeHandleClass,
		startResize,
		startTitlebarDrag,
		toggleMaximizeWindow,
	};
}
