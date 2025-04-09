import ShortUniqueId from "short-unique-id";
const { randomUUID } = new ShortUniqueId({
	length: 10,
	dictionary: "alphanum_lower",
});

export function createShortId() {
	return randomUUID();
}
