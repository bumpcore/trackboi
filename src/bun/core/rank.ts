const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const MIN_DIGIT = 0;
const MAX_DIGIT = DIGITS.length - 1;
const MID_DIGIT = Math.floor(MAX_DIGIT / 2);

function digitAt(value: string | null, index: number, fallback: number) {
	if (value == null || index >= value.length) return fallback;
	const digit = DIGITS.indexOf(value[index]);
	if (digit === -1) {
		throw new Error(`Invalid rank character: ${value[index]}`);
	}
	return digit;
}

export function rankBetween(before: string | null, after: string | null) {
	if (before != null && after != null && before >= after) {
		throw new Error(`Cannot rank between ${before} and ${after}`);
	}

	let prefix = "";

	for (let index = 0; ; index += 1) {
		const low = digitAt(before, index, MIN_DIGIT);
		const high = digitAt(after, index, MAX_DIGIT);

		if (high - low > 1) {
			return `${prefix}${DIGITS[Math.floor((low + high) / 2)]}`;
		}

		prefix += DIGITS[low] ?? DIGITS[MID_DIGIT];
	}
}

