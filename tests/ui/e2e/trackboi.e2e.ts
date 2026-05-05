import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { ElectronApplication, Locator, Page } from "@playwright/test";
import { createUiFixture, seededIds, type UiFixture } from "./fixture";

test.describe.configure({ mode: "serial" });

const packageVersion = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8")).version as string;

let fixture: UiFixture;
let app: ElectronApplication | null = null;
let page: Page;

test.beforeEach(async () => {
	fixture = createUiFixture();
	({ app, page } = await fixture.launch());
});

test.afterEach(async () => {
	await app?.close();
	fixture.cleanup();
	app = null;
});

test("keeps empty-state top aligned and supports drag/drop plus card context interactions", async () => {
	const doingList = page.getByTestId("column-doing-list");
	const doingEmpty = page.getByTestId("column-doing-empty");
	const doingListBox = await doingList.boundingBox();
	const doingEmptyBox = await doingEmpty.boundingBox();

	expect(doingListBox).not.toBeNull();
	expect(doingEmptyBox).not.toBeNull();
	expect((doingEmptyBox?.y ?? 0) - (doingListBox?.y ?? 0)).toBeLessThan(24);

	await expect.poll(() => columnCardIds(page, "todo")).toEqual([
		seededIds.cardAlpha,
		seededIds.cardBeta,
	]);

	await dragCard(page, page.getByTestId(`card-${seededIds.cardBeta}`), page.getByTestId(`card-${seededIds.cardAlpha}`), "top");
	await expect.poll(() => columnCardIds(page, "todo")).toEqual([
		seededIds.cardBeta,
		seededIds.cardAlpha,
	]);

	await expect.poll(() => columnCardIds(page, "done")).toEqual([seededIds.cardGamma]);
	await expect.poll(() => columnCardIds(page, "todo")).toEqual([
		seededIds.cardBeta,
		seededIds.cardAlpha,
	]);

	const alphaCard = page.getByTestId(`card-${seededIds.cardAlpha}`);
	await page.waitForTimeout(150);
	await alphaCard.dblclick();
	await expect(page.getByTestId("card-editor")).toBeVisible();
	await expect(page.getByTestId("card-editor").getByLabel("Title")).toHaveValue("Alpha task");

	const cardBox = await alphaCard.boundingBox();
	await alphaCard.click({ button: "right" });
	const menu = page.getByTestId("card-context-menu");
	await expect(menu).toBeVisible();
	const menuBox = await menu.boundingBox();
	expect(menuBox).not.toBeNull();
	expect(Math.abs((menuBox?.x ?? 0) - (cardBox?.x ?? 0))).toBeLessThan(280);
	expect(Math.abs((menuBox?.y ?? 0) - (cardBox?.y ?? 0))).toBeLessThan(220);

	await page.getByTestId("card-context-move").hover();
	await expect(page.getByTestId("card-context-move-menu")).toBeVisible();
	await page.getByTestId("card-context-move-done").click();
	await expect.poll(() => columnCardIds(page, "done")).toContain(seededIds.cardAlpha);

	await page.getByTestId(`card-${seededIds.cardAlpha}`).click();
	await page.keyboard.press("Delete");
	await expect(page.getByTestId("confirm-dialog")).toBeVisible();
});

test("switches board and worktree context and opens the settings surfaces", async () => {
	await expect(page.getByTestId("app-version-indicator")).toHaveText(`v${packageVersion}`);

	await page.getByTestId("board-delivery").click();
	await expect(page.getByText("Delivery board card")).toBeVisible();
	await expect(page.getByTestId(`card-${seededIds.cardAlpha}`)).toHaveCount(0);

	await page
		.getByTestId("worktree-list")
		.locator("button")
		.filter({ hasText: "onboarding" })
		.click();

	await expect(page.getByText("Onboarding context card")).toBeVisible();
	await expect(page.getByRole("heading", { name: "trackboi / Onboarding board" })).toBeVisible();

	await page.getByTestId("board-settings-default").click();
	await expect(page.getByTestId("board-settings-modal")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("board-settings-modal")).toHaveCount(0);

	await page.getByTestId("app-settings-button").click();
	await expect(page.getByTestId("app-settings-modal")).toBeVisible();
	await page.getByRole("button", { name: "Current project" }).click();
	await expect(page.getByTestId("app-settings-modal").getByRole("heading", { name: "Project settings" })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("app-settings-modal")).toHaveCount(0);

	await page.getByTestId("app-settings-button").click();
	await expect(page.getByTestId("app-settings-modal")).toBeVisible();
	await page.getByRole("button", { name: "About" }).click();
	await expect(page.getByTestId("app-settings-modal").getByRole("heading", { name: `trackboi v${packageVersion}` })).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("app-settings-modal")).toHaveCount(0);
});

test("command palette keeps the command prefix editable and falls back to navigation", async () => {
	await page.keyboard.press("Control+Shift+P");
	await expect(page.getByTestId("command-center")).toBeVisible();
	const input = page.getByTestId("command-center-input");
	await expect(input).toHaveValue(">");
	await expect(page.getByText("Open settings")).toBeVisible();

	await expect.poll(async () => input.evaluate((element) => ({
		start: (element as HTMLInputElement).selectionStart,
		end: (element as HTMLInputElement).selectionEnd,
	}))).toEqual({ start: 1, end: 1 });

	await page.keyboard.press("Backspace");
	await expect(input).toHaveValue("");
	await expect(page.getByTestId("command-center").getByText("Open settings")).toHaveCount(0);
	await expect(page.getByTestId("command-center").getByText("Alpha task")).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(page.getByTestId("command-center")).toHaveCount(0);
});

test("creates, edits, and deletes cards and tracks in the Electron shell", async () => {
	await page.getByTestId("board-new-card").click();
	await expect(page.getByTestId("card-editor")).toBeVisible();
	await page.getByTestId("card-editor").getByLabel("Title").fill("UI created card");
	await page.getByTestId("card-editor").locator("textarea").first().fill("A card created through Playwright.");
	await page.getByTestId("card-submit-button").click();
	await expect(page.locator("[data-card-id]", { hasText: "UI created card" })).toBeVisible();

	const createdCard = page.locator("[data-card-id]", { hasText: "UI created card" }).first();
	await createdCard.click();
	await createdCard.press("Enter");
	await expect(page.getByTestId("card-submit-button")).toHaveText("Save Card");
	await expect(page.getByTestId("card-editor").getByLabel("Title")).toHaveValue("UI created card");
	const cardTitleInput = page.getByTestId("card-editor").getByLabel("Title");
	await cardTitleInput.fill("UI created card updated");
	await expect(cardTitleInput).toHaveValue("UI created card updated");
	await page.getByTestId("card-submit-button").click();
	await expect(page.locator("[data-card-id]", { hasText: "UI created card updated" })).toBeVisible();

	await page.locator("[data-card-id]", { hasText: "UI created card updated" }).click();
	await page.keyboard.press("Delete");
	await expect(page.getByTestId("confirm-dialog")).toBeVisible();
	await page.getByTestId("confirm-dialog").getByRole("button", { name: "Delete" }).click();
	await expect(page.locator("[data-card-id]", { hasText: "UI created card updated" })).toHaveCount(0);

	await page.getByTestId("create-track-button").click();
	await expect(page.getByTestId("track-editor")).toBeVisible();
	await page.getByTestId("track-editor").getByLabel("Title").fill("UI track");
	await page.getByTestId("track-editor").locator("textarea").first().fill("Track summary from UI test.");
	await page.getByTestId("track-submit-button").click();
	await expect(page.getByTestId("track-list").locator("button").filter({ hasText: "UI track" })).toBeVisible();

	await page.getByTestId("track-list").locator("button").filter({ hasText: "UI track" }).click();
	await page.getByTestId("track-editor").getByLabel("Title").fill("UI track updated");
	await page.getByTestId("track-submit-button").click();
	await expect(page.getByTestId("track-list").locator("button").filter({ hasText: "UI track updated" })).toBeVisible();

	await page.getByTestId("track-delete-button").click();
	await expect(page.getByTestId("confirm-dialog")).toBeVisible();
	await page.getByTestId("confirm-dialog").getByRole("button", { name: "Delete" }).click();
	await expect(page.getByTestId("track-list").locator("button").filter({ hasText: "UI track updated" })).toHaveCount(0);
});

test("manages board settings including board creation and board-scoped custom fields", async () => {
	await page.getByTestId("board-create-button").click();
	await expect(page.getByTestId("board-create-modal")).toBeVisible();
	await page.getByTestId("board-create-modal").getByLabel("Name").fill("UI board");
	await page.getByTestId("board-create-modal").getByRole("button", { name: "Create" }).click();
	await expect(page.getByRole("heading", { name: "trackboi / UI board" })).toBeVisible();

	await page.getByTestId("board-settings-ui-board").click();
	await expect(page.getByTestId("board-settings-modal")).toBeVisible();
	await page.getByTestId("board-settings-modal").getByLabel("Field name").fill("Severity");
	await page.getByTestId("board-settings-modal").getByLabel("Field type").click();
	await page.getByRole("option", { name: "Select" }).click();
	await page.getByTestId("board-settings-modal").getByLabel("Options").fill("Low, High");
	await page.getByTestId("board-settings-modal").getByRole("button", { name: "Add" }).click();
	await expect(page.getByTestId("board-settings-modal").getByText("Severity")).toBeVisible();

	await page.keyboard.press("Escape");
	await page.getByTestId("board-new-card").click();
	await expect(page.getByTestId("card-editor")).toBeVisible();
	await expect(page.getByTestId("card-editor").getByText("Severity")).toBeVisible();
});

test("adds a new column from the ghost lane affordance", async () => {
	await page.getByTestId("board-add-column").click();
	await page.getByLabel("Name").fill("Review");
	await page.getByTestId("column-submit-button").click();
	await expect(page.getByTestId("column-review-list")).toBeVisible();
});

test("manages project aliases and agent identity through settings flows", async () => {
	await page.getByTestId("app-settings-button").click();
	await expect(page.getByTestId("app-settings-modal")).toBeVisible();
	await page.getByRole("button", { name: "Current project" }).click();
	await page.getByTestId("app-settings-modal").getByLabel("Display name").fill("Abdul Kadir");
	await page.getByTestId("app-settings-modal").getByLabel("Git emails").fill("work@example.com, alt@example.com");
	await page.getByTestId("app-settings-modal").getByLabel("Git names").fill("Abdulkadir, Abdul Kadir");
	await page.getByTestId("app-settings-modal").getByRole("button", { name: "Add person" }).click();
	await expect(page.getByTestId("app-settings-modal").locator("p").filter({ hasText: /^Abdul Kadir$/ })).toBeVisible();
	await page.keyboard.press("Escape");

	await page.getByTestId("app-settings-button").click();
	await expect(page.getByTestId("app-settings-modal")).toBeVisible();
	await page.getByTestId("app-settings-modal").getByRole("button", { name: "My agent" }).click();
	await expect(page.getByTestId("app-settings-modal").getByRole("heading", { name: "Agent identity", exact: true })).toBeVisible();
	await page.getByTestId("app-settings-modal").getByLabel("Handle").fill("Playwright Agent");
	await page.getByTestId("app-settings-modal").getByLabel("Note").fill("UI integration actor");
	await page.getByTestId("app-settings-modal").getByRole("button", { name: "Save" }).click();
	await expect(page.getByTestId("app-settings-modal").getByText("Playwright Agent")).toBeVisible();

	await page.getByTestId("app-settings-modal").getByRole("button", { name: "Editor" }).click();
	await page.getByTestId("app-settings-modal").getByRole("button", { name: "Custom command" }).click();
	await page.getByTestId("app-settings-modal").getByLabel("Command").fill("cursor {path}");
	await page.getByTestId("app-settings-modal").getByRole("button", { name: "Save" }).click();

	await page.keyboard.press("Escape");
	await page.getByTestId("app-settings-button").click();
	await page.getByTestId("app-settings-modal").getByRole("button", { name: "Editor" }).click();
	await expect(page.getByTestId("app-settings-modal").getByLabel("Command")).toHaveValue("cursor {path}");
});

test("forgets a manually added project from current project settings", async () => {
	await page.getByTestId("app-settings-button").click();
	await expect(page.getByTestId("app-settings-modal")).toBeVisible();
	await page.getByRole("button", { name: "Current project" }).click();

	await page.getByTestId("project-remove-button").click();
	await expect(page.getByTestId("confirm-dialog")).toBeVisible();
	await expect(page.getByTestId("confirm-dialog")).toContainText("trackboi will forget this project");
	await page.getByTestId("confirm-dialog").getByRole("button", { name: "Remove" }).click();

	await expect(page.getByRole("heading", { name: "Pick a repo" })).toBeVisible();
	await expect(page.getByTestId("app-settings-modal")).toHaveCount(0);
});

async function columnCardIds(page: Page, columnId: string): Promise<string[]> {
	return page.getByTestId(`column-${columnId}-list`).locator("[data-card-id]").evaluateAll((elements) => (
		elements
			.map((element) => element.getAttribute("data-card-id"))
			.filter((value): value is string => Boolean(value))
	));
}

async function dragCard(page: Page, source: Locator, target: Locator, verticalAnchor: "top" | "center") {
	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();

	if (!sourceBox || !targetBox) {
		throw new Error("Missing drag bounding box");
	}

	const targetY = verticalAnchor === "top"
		? targetBox.y + 18
		: targetBox.y + (targetBox.height / 2);

	await page.mouse.move(sourceBox.x + (sourceBox.width / 2), sourceBox.y + (sourceBox.height / 2));
	await page.mouse.down();
	await page.mouse.move(targetBox.x + (targetBox.width / 2), targetY, { steps: 24 });
	await page.mouse.up();
}
