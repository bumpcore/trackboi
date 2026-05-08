import { computed, getCurrentInstance, onBeforeUnmount, ref, watch, type Ref } from "vue";
import type { LeftPanelView, RightPanelView, WorkspaceShellPrefs } from "@/ui/viewTypes";

const DEFAULT_PREFS: WorkspaceShellPrefs = {
	leftWidth: 248,
	rightWidth: 456,
	leftCollapsed: false,
	rightCollapsed: false,
	leftView: "explorer",
	rightView: "card",
};

const LEFT_MIN_WIDTH = 216;
const LEFT_DEFAULT_WIDTH = DEFAULT_PREFS.leftWidth;
const LEFT_COLLAPSE_THRESHOLD = 164;
const LEFT_REOPEN_THRESHOLD = 184;
const RIGHT_MIN_WIDTH = 360;
const RIGHT_DEFAULT_WIDTH = DEFAULT_PREFS.rightWidth;
const RIGHT_COLLAPSE_THRESHOLD = 280;
const RIGHT_REOPEN_THRESHOLD = 324;
const COLLAPSED_RIGHT_WIDTH = 44;
const LEFT_RAIL_WIDTH = 56;
const MAIN_WORKSPACE_MIN_WIDTH = 420;

type ResizeSide = "left" | "right";

type WorkspaceShellState = {
	leftWidth: Ref<number>;
	rightWidth: Ref<number>;
	leftCollapsed: Ref<boolean>;
	rightCollapsed: Ref<boolean>;
	leftView: Ref<LeftPanelView>;
	rightView: Ref<RightPanelView>;
	leftPanelWidth: Readonly<Ref<number>>;
	rightPanelWidth: Readonly<Ref<number>>;
	leftResizeClass: Ref<string>;
	rightResizeClass: Ref<string>;
	setLeftView(view: LeftPanelView): void;
	setRightView(view: RightPanelView, options?: { reveal?: boolean }): void;
	toggleLeftCollapsed(): void;
	toggleRightCollapsed(): void;
	resetLeftWidth(): void;
	resetRightWidth(): void;
	startResize(side: ResizeSide, event: PointerEvent): void;
};

type ResolvedPanelWidths = {
	left: number;
	right: number;
};

function normalizeLeftView(): LeftPanelView {
	return "explorer";
}

function normalizeRightView(value: unknown): RightPanelView {
	return value === "track" || value === "activity" || value === "context" || value === "column" ? value : "card";
}

/**
 * Persists the desktop shell layout as a global user preference and recreates
 * the concept panel behavior in the real renderer: hidden resize gutters,
 * threshold-based collapse/expand, and independent left/right view containers.
 */
export function useWorkspaceShellState(): WorkspaceShellState {
	const leftWidth = ref(DEFAULT_PREFS.leftWidth);
	const rightWidth = ref(DEFAULT_PREFS.rightWidth);
	const leftCollapsed = ref(DEFAULT_PREFS.leftCollapsed);
	const rightCollapsed = ref(DEFAULT_PREFS.rightCollapsed);
	const leftView = ref<LeftPanelView>(DEFAULT_PREFS.leftView);
	const rightView = ref<RightPanelView>(DEFAULT_PREFS.rightView);
	const leftResizeClass = ref("");
	const rightResizeClass = ref("");
	const viewportWidth = ref(typeof window === "undefined" ? 1440 : window.innerWidth);

	/**
	 * Resolves preferred side-panel widths like a code editor: the dragged panel
	 * keeps the width the user set, and the center board takes the remaining
	 * space. Clamping only happens when the viewport is too small to fit the
	 * minimum board and side-panel widths.
	 */
	function resolvePanelWidths(): ResolvedPanelWidths {
		const leftBase = leftCollapsed.value ? 0 : LEFT_MIN_WIDTH;
		const rightBase = rightCollapsed.value ? COLLAPSED_RIGHT_WIDTH : RIGHT_MIN_WIDTH;
		const shellWidth = Math.max(0, viewportWidth.value - LEFT_RAIL_WIDTH);
		const maxPanelWidth = Math.max(leftBase + rightBase, shellWidth - MAIN_WORKSPACE_MIN_WIDTH);
		let nextLeft = leftCollapsed.value ? 0 : Math.max(LEFT_MIN_WIDTH, leftWidth.value);
		let nextRight = rightCollapsed.value ? COLLAPSED_RIGHT_WIDTH : Math.max(RIGHT_MIN_WIDTH, rightWidth.value);
		const overflow = Math.max(0, nextLeft + nextRight - maxPanelWidth);

		if (overflow > 0 && !rightCollapsed.value) {
			const trim = Math.min(overflow, Math.max(0, nextRight - rightBase));
			nextRight -= trim;
		}

		const remainingOverflow = Math.max(0, nextLeft + nextRight - maxPanelWidth);
		if (remainingOverflow > 0 && !leftCollapsed.value) {
			const trim = Math.min(remainingOverflow, Math.max(0, nextLeft - leftBase));
			nextLeft -= trim;
		}

		return {
			left: Math.round(nextLeft),
			right: Math.round(nextRight),
		};
	}

	const resolvedPanelWidths = computed(resolvePanelWidths);
	const leftPanelWidth = computed(() => resolvedPanelWidths.value.left);
	const rightPanelWidth = computed(() => resolvedPanelWidths.value.right);

	let activeCleanup: (() => void) | null = null;
	const storageKey = "trackboi:shell:v3:global";

	function readPrefs(): WorkspaceShellPrefs {
		if (typeof window === "undefined") return { ...DEFAULT_PREFS };
		try {
			const raw = window.localStorage.getItem(storageKey);
			if (!raw) return { ...DEFAULT_PREFS };
			const parsed = JSON.parse(raw) as Partial<WorkspaceShellPrefs>;
			return {
				leftWidth: typeof parsed.leftWidth === "number" ? parsed.leftWidth : DEFAULT_PREFS.leftWidth,
				rightWidth: typeof parsed.rightWidth === "number" ? parsed.rightWidth : DEFAULT_PREFS.rightWidth,
				leftCollapsed: typeof parsed.leftCollapsed === "boolean" ? parsed.leftCollapsed : DEFAULT_PREFS.leftCollapsed,
				rightCollapsed: typeof parsed.rightCollapsed === "boolean" ? parsed.rightCollapsed : DEFAULT_PREFS.rightCollapsed,
				leftView: normalizeLeftView(),
				rightView: normalizeRightView(parsed.rightView),
			};
		} catch {
			return { ...DEFAULT_PREFS };
		}
	}

	function writePrefs() {
		if (typeof window === "undefined") return;
		const prefs: WorkspaceShellPrefs = {
			leftWidth: leftWidth.value,
			rightWidth: rightWidth.value,
			leftCollapsed: leftCollapsed.value,
			rightCollapsed: rightCollapsed.value,
			leftView: leftView.value,
			rightView: rightView.value,
		};
		window.localStorage.setItem(storageKey, JSON.stringify(prefs));
	}

	function syncViewportWidth() {
		if (typeof window === "undefined") return;
		viewportWidth.value = window.innerWidth;
	}

	function applyPrefs(prefs: WorkspaceShellPrefs) {
		leftWidth.value = Math.max(LEFT_MIN_WIDTH, prefs.leftWidth);
		rightWidth.value = Math.max(RIGHT_MIN_WIDTH, prefs.rightWidth);
		leftCollapsed.value = prefs.leftCollapsed;
		rightCollapsed.value = prefs.rightCollapsed;
		leftView.value = normalizeLeftView();
		rightView.value = normalizeRightView(prefs.rightView);
	}

	applyPrefs(readPrefs());

	watch(
		[leftWidth, rightWidth, leftCollapsed, rightCollapsed, leftView, rightView],
		() => {
			writePrefs();
		},
	);

	function setLeftView(view: LeftPanelView) {
		leftView.value = view;
		if (leftCollapsed.value) leftCollapsed.value = false;
	}

	function setRightView(view: RightPanelView, options: { reveal?: boolean } = {}) {
		rightView.value = view;
		if (options.reveal !== false && rightCollapsed.value) rightCollapsed.value = false;
	}

	function toggleLeftCollapsed() {
		leftCollapsed.value = !leftCollapsed.value;
	}

	function toggleRightCollapsed() {
		rightCollapsed.value = !rightCollapsed.value;
	}

	function resetLeftWidth() {
		leftWidth.value = LEFT_DEFAULT_WIDTH;
		if (leftCollapsed.value) leftCollapsed.value = false;
	}

	function resetRightWidth() {
		rightWidth.value = RIGHT_DEFAULT_WIDTH;
		if (rightCollapsed.value) rightCollapsed.value = false;
	}

	function startResize(side: ResizeSide, event: PointerEvent) {
		if (typeof window === "undefined") return;
		event.preventDefault();
		activeCleanup?.();
		const startX = event.clientX;
		const startLeftWidth = leftWidth.value;
		const startRightWidth = rightWidth.value;
		const startLeftCollapsed = leftCollapsed.value;
		const startRightCollapsed = rightCollapsed.value;
		const startLeftVisualWidth = leftPanelWidth.value;
		const startRightVisualWidth = rightPanelWidth.value;

		if (side === "left") leftResizeClass.value = "resizing";
		if (side === "right") rightResizeClass.value = "resizing";
		window.document.body.classList.add("trackboi-resizing");
		window.getSelection()?.removeAllRanges();

		const onPointerMove = (moveEvent: PointerEvent) => {
			moveEvent.preventDefault();
			const delta = moveEvent.clientX - startX;
			if (side === "left") {
				const nextWidth = startLeftVisualWidth + delta;
				if (startLeftCollapsed) {
					if (nextWidth >= LEFT_REOPEN_THRESHOLD) {
						leftCollapsed.value = false;
						leftWidth.value = Math.max(LEFT_MIN_WIDTH, nextWidth);
					}
					return;
				}

				if (nextWidth <= LEFT_COLLAPSE_THRESHOLD) {
					leftCollapsed.value = true;
					return;
				}

				leftCollapsed.value = false;
				leftWidth.value = Math.max(LEFT_MIN_WIDTH, nextWidth);
				return;
			}

			const nextWidth = startRightVisualWidth - delta;
			if (startRightCollapsed) {
				if (nextWidth >= RIGHT_REOPEN_THRESHOLD) {
					rightCollapsed.value = false;
					rightWidth.value = Math.max(RIGHT_MIN_WIDTH, nextWidth);
				}
				return;
			}

			if (nextWidth <= RIGHT_COLLAPSE_THRESHOLD) {
				rightCollapsed.value = true;
				return;
			}

			rightCollapsed.value = false;
			rightWidth.value = Math.max(RIGHT_MIN_WIDTH, nextWidth);
		};

		const onPointerUp = () => {
			leftResizeClass.value = "";
			rightResizeClass.value = "";
			window.document.body.classList.remove("trackboi-resizing");
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			activeCleanup = null;

			if (side === "left" && !startLeftCollapsed && leftCollapsed.value) {
				leftWidth.value = startLeftWidth;
			}
			if (side === "right" && !startRightCollapsed && rightCollapsed.value) {
				rightWidth.value = startRightWidth;
			}
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		activeCleanup = () => {
			leftResizeClass.value = "";
			rightResizeClass.value = "";
			window.document.body.classList.remove("trackboi-resizing");
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			activeCleanup = null;
		};
	}

	if (getCurrentInstance()) {
		onBeforeUnmount(() => {
			activeCleanup?.();
			if (typeof window !== "undefined") window.removeEventListener("resize", syncViewportWidth);
		});
	}

	if (typeof window !== "undefined") {
		window.addEventListener("resize", syncViewportWidth);
	}

	return {
		leftWidth,
		rightWidth,
		leftCollapsed,
		rightCollapsed,
		leftView,
		rightView,
		leftPanelWidth,
		rightPanelWidth,
		leftResizeClass,
		rightResizeClass,
		setLeftView,
		setRightView,
		toggleLeftCollapsed,
		toggleRightCollapsed,
		resetLeftWidth,
		resetRightWidth,
		startResize,
	};
}
