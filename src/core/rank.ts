import { RANK_ALPHABET } from "./constants";

/**
 * Returns a lexicographic rank between two neighboring ranks.
 *
 * `null` means the open end of the list. Ranks are stored on cards so moving a
 * card rewrites only that card file instead of creating a hot board-order file.
 */
export function rankBetween(previous: string | null, next: string | null): string {
	const min = 0;
	const max = RANK_ALPHABET.length - 1;
	const left = previous ?? "";
	const right = next ?? "";
	let prefix = "";
	let index = 0;

	while (true) {
		const leftValue = index < left.length ? RANK_ALPHABET.indexOf(left[index] ?? "") : min;
		const rightValue = index < right.length ? RANK_ALPHABET.indexOf(right[index] ?? "") : max;

		if (leftValue < 0 || rightValue < 0) {
			throw new Error("Invalid rank");
		}

		if (rightValue - leftValue > 1) {
			const middle = Math.floor((leftValue + rightValue) / 2);
			return `${prefix}${RANK_ALPHABET[middle]}`;
		}

		prefix += index < left.length ? left[index] : RANK_ALPHABET[leftValue];
		index += 1;
	}
}
