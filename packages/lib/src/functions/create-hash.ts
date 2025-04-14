import { subtle } from "uncrypto";

//inspired by oslo implementation by pilcrowonpaper: https://github.com/pilcrowonpaper/oslo/blob/main/src/encoding/base64.ts

export type TypedArray =
	| Uint8Array
	| Int8Array
	| Uint16Array
	| Int16Array
	| Uint32Array
	| Int32Array
	| Float32Array
	| Float64Array
	| BigInt64Array
	| BigUint64Array;

export type SHAFamily = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
export type EncodingFormat =
	| "hex"
	| "base64"
	| "base64url"
	| "base64urlnopad"
	| "none";

function getAlphabet(urlSafe: boolean): string {
	return urlSafe
		? "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
		: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
}

function base64Encode(
	data: Uint8Array,
	alphabet: string,
	padding: boolean
): string {
	let result = "";
	let buffer = 0;
	let shift = 0;

	for (const byte of data) {
		buffer = (buffer << 8) | byte;
		shift += 8;
		while (shift >= 6) {
			shift -= 6;
			result += alphabet[(buffer >> shift) & 0x3f];
		}
	}

	if (shift > 0) {
		result += alphabet[(buffer << (6 - shift)) & 0x3f];
	}

	if (padding) {
		const padCount = (4 - (result.length % 4)) % 4;
		result += "=".repeat(padCount);
	}

	return result;
}

function base64Decode(data: string, alphabet: string): Uint8Array {
	const decodeMap = new Map<string, number>();
	for (let i = 0; i < alphabet.length; i++) {
		decodeMap.set(alphabet[i]!, i);
	}
	const result: number[] = [];
	let buffer = 0;
	let bitsCollected = 0;

	for (const char of data) {
		if (char === "=") break;
		const value = decodeMap.get(char);
		if (value === undefined) {
			throw new Error(`Invalid Base64 character: ${char}`);
		}
		buffer = (buffer << 6) | value;
		bitsCollected += 6;

		if (bitsCollected >= 8) {
			bitsCollected -= 8;
			result.push((buffer >> bitsCollected) & 0xff);
		}
	}

	return Uint8Array.from(result);
}

const base64 = {
	encode(
		data: ArrayBuffer | TypedArray | string,
		options: { padding?: boolean } = {}
	) {
		const alphabet = getAlphabet(false);
		const buffer =
			typeof data === "string"
				? new TextEncoder().encode(data)
				: new Uint8Array(data);
		return base64Encode(buffer, alphabet, options.padding ?? true);
	},
	decode(data: string | ArrayBuffer | TypedArray) {
		if (typeof data !== "string") {
			data = new TextDecoder().decode(data);
		}
		const urlSafe = data.includes("-") || data.includes("_");
		const alphabet = getAlphabet(urlSafe);
		return base64Decode(data, alphabet);
	},
};

export const base64Url = {
	encode(
		data: ArrayBuffer | TypedArray | string,
		options: { padding?: boolean } = {}
	) {
		const alphabet = getAlphabet(true);
		const buffer =
			typeof data === "string"
				? new TextEncoder().encode(data)
				: new Uint8Array(data);
		return base64Encode(buffer, alphabet, options.padding ?? true);
	},
	decode(data: string) {
		const urlSafe = data.includes("-") || data.includes("_");
		const alphabet = getAlphabet(urlSafe);
		return base64Decode(data, alphabet);
	},
};

export function createHash<Encoding extends EncodingFormat = "none">(
	algorithm: SHAFamily,
	encoding?: Encoding
) {
	return {
		digest: async (
			input: string | ArrayBuffer | TypedArray
		): Promise<Encoding extends "none" ? ArrayBuffer : string> => {
			const encoder = new TextEncoder();
			const data = typeof input === "string" ? encoder.encode(input) : input;
			const hashBuffer = await subtle.digest(algorithm, data);

			if (encoding === "hex") {
				const hashArray = Array.from(new Uint8Array(hashBuffer));
				const hashHex = hashArray
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");
				return hashHex as any;
			}

			if (
				encoding === "base64" ||
				encoding === "base64url" ||
				encoding === "base64urlnopad"
			) {
				if (encoding.includes("url")) {
					return base64Url.encode(hashBuffer, {
						padding: encoding !== "base64urlnopad",
					}) as any;
				}
				const hashBase64 = base64.encode(hashBuffer);
				return hashBase64 as any;
			}
			return hashBuffer as any;
		},
	};
}
