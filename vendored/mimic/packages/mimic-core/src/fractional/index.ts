export interface Charset {
  readonly chars: string;
  readonly byChar: Readonly<Record<string, number>>;
  readonly byCode: Readonly<Record<number, string>>;
  readonly length: number;
  readonly first: string;
  readonly last: string;
  readonly firstPositive: string;
  readonly mostPositive: string;
  readonly firstNegative: string;
  readonly mostNegative: string;
  readonly jitterRange: number;
  readonly paddingDict: Readonly<Record<number, number>>;
}

export interface CharsetOptions {
  readonly chars: string;
  readonly firstPositive: string;
  readonly mostPositive: string;
  readonly mostNegative: string;
  readonly jitterRange?: number;
}

export interface RandomSource {
  next(): number;
}

export class CryptoRandomSource implements RandomSource {
  next(): number {
    const cryptoObject = globalThis.crypto;
    if (cryptoObject?.getRandomValues) {
      const buffer = new Uint32Array(2);
      cryptoObject.getRandomValues(buffer);
      const high = buffer[0]! >>> 5;
      const low = buffer[1]! >>> 6;
      return (high * 67108864 + low) / 9007199254740992;
    }
    return Math.random();
  }
}

export class Generator {
  readonly charset: Charset;
  readonly random?: RandomSource;
  readonly useJitter: boolean;

  constructor(options?: { charset?: Charset; random?: RandomSource; useJitter?: boolean }) {
    this.charset = options?.charset ?? base62();
    this.random = options?.random;
    this.useJitter = options?.useJitter ?? true;
  }

  between(lower?: string, upper?: string): string {
    if (this.useJitter) {
      return generateJitteredKeyBetween(
        lower,
        upper,
        this.charset,
        this.random ?? new CryptoRandomSource(),
      );
    }
    return generateKeyBetween(lower, upper, this.charset);
  }
}

export const createCharset = (options: CharsetOptions): Charset => {
  if (options.chars.length < 7) {
    throw new Error("charSet must be at least 7 characters long");
  }
  const sorted = options.chars.split("").sort().join("");
  if (sorted !== options.chars) {
    throw new Error("charSet must be sorted");
  }

  const byChar: Record<string, number> = {};
  const byCode: Record<number, string> = {};
  for (let index = 0; index < options.chars.length; index += 1) {
    const char = options.chars[index]!;
    byChar[char] = index;
    byCode[index] = char;
  }

  const firstPositiveIndex = byChar[options.firstPositive];
  const mostPositiveIndex = byChar[options.mostPositive];
  const mostNegativeIndex = byChar[options.mostNegative];
  if (firstPositiveIndex === undefined) throw new Error("invalid firstPositive");
  if (mostPositiveIndex === undefined) throw new Error("invalid mostPositive");
  if (mostNegativeIndex === undefined) throw new Error("invalid mostNegative");
  if (mostPositiveIndex - firstPositiveIndex < 3) {
    throw new Error("mostPositive must be at least 3 characters away from neutral");
  }
  if (firstPositiveIndex - mostNegativeIndex < 3) {
    throw new Error("mostNegative must be at least 3 characters away from neutral");
  }

  const jitterRange = options.jitterRange ?? Math.floor(pow(options.chars.length, 3) / 5);
  return {
    chars: options.chars,
    byChar,
    byCode,
    length: options.chars.length,
    first: byCode[0]!,
    last: byCode[options.chars.length - 1]!,
    firstPositive: options.firstPositive,
    mostPositive: options.mostPositive,
    firstNegative: byCode[firstPositiveIndex - 1]!,
    mostNegative: options.mostNegative,
    jitterRange,
    paddingDict: buildPaddingDict(jitterRange, options.chars.length),
  };
};

const BASE62 = createCharset({
  chars: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  firstPositive: "a",
  mostPositive: "z",
  mostNegative: "A",
});

export const base62 = (): Charset => BASE62;

export const createDeterministicGenerator = (): Generator =>
  new Generator({ charset: base62(), useJitter: false });

export const createGenerator = (): Generator => new Generator({ charset: base62() });

export const createGeneratorWithRandom = (random: RandomSource): Generator =>
  new Generator({ charset: base62(), random, useJitter: true });

export const startKey = (charset: Charset): string =>
  `${charset.firstPositive}${charset.byCode[0]}`;

export const validateOrderKey = (orderKey: string, charset: Charset): void => {
  getIntegerPart(orderKey, charset);
};

export const generateKeyBetween = (
  lower: string | undefined,
  upper: string | undefined,
  charset: Charset,
): string => {
  if (lower !== undefined) validateOrderKey(lower, charset);
  if (upper !== undefined) validateOrderKey(upper, charset);
  if (lower === undefined && upper === undefined) return startKey(charset);
  if (lower === undefined) return decrementInteger(getIntegerPart(upper!, charset), charset);
  if (upper === undefined) return incrementInteger(getIntegerPart(lower, charset), charset);
  if (lower >= upper) throw new Error(`${lower} >= ${upper}`);
  return midPoint(lower, upper, charset);
};

export const generateNKeysBetween = (
  lower: string | undefined,
  upper: string | undefined,
  count: number,
  charset: Charset,
): string[] => {
  if (count < 0) throw new Error("n must be >= 0");
  if (count === 0) return [];
  if (count === 1) return [generateKeyBetween(lower, upper, charset)];

  if (upper === undefined) {
    const first = generateKeyBetween(lower, upper, charset);
    const result = [first];
    let current = first;
    for (let index = 0; index < count - 1; index += 1) {
      current = generateKeyBetween(current, undefined, charset);
      result.push(current);
    }
    return result;
  }

  if (lower === undefined) {
    const first = generateKeyBetween(undefined, upper, charset);
    const result = [first];
    let current = first;
    for (let index = 0; index < count - 1; index += 1) {
      current = generateKeyBetween(undefined, current, charset);
      result.push(current);
    }
    return result.reverse();
  }

  const mid = Math.floor(count / 2);
  const midKey = generateKeyBetween(lower, upper, charset);
  return [
    ...generateNKeysBetween(lower, midKey, mid, charset),
    midKey,
    ...generateNKeysBetween(midKey, upper, count - mid - 1, charset),
  ];
};

export const generateJitteredKeyBetween = (
  lower: string | undefined,
  upper: string | undefined,
  charset: Charset,
  random: RandomSource,
): string => {
  const key = generateKeyBetween(lower, upper, charset);
  const paddingNeeded = paddingNeededForJitter(key, upper, charset);
  if (paddingNeeded > 0) {
    return padAndJitterString(key, paddingNeeded, charset, random);
  }
  return jitterString(key, charset, random);
};

export const generateNJitteredKeysBetween = (
  lower: string | undefined,
  upper: string | undefined,
  count: number,
  charset: Charset,
  random: RandomSource,
): string[] => {
  if (count < 0) throw new Error("n must be >= 0");
  if (count === 0) return [];
  if (count === 1) {
    return [generateJitteredKeyBetween(lower, upper, charset, random)];
  }

  if (upper === undefined) {
    const first = generateJitteredKeyBetween(lower, upper, charset, random);
    const result = [first];
    let current = first;
    for (let index = 0; index < count - 1; index += 1) {
      current = generateJitteredKeyBetween(current, undefined, charset, random);
      result.push(current);
    }
    return result;
  }

  if (lower === undefined) {
    const first = generateJitteredKeyBetween(undefined, upper, charset, random);
    const result = [first];
    let current = first;
    for (let index = 0; index < count - 1; index += 1) {
      current = generateJitteredKeyBetween(undefined, current, charset, random);
      result.push(current);
    }
    return result.reverse();
  }

  const mid = Math.floor(count / 2);
  const midKey = generateJitteredKeyBetween(lower, upper, charset, random);
  return [
    ...generateNJitteredKeysBetween(lower, midKey, mid, charset, random),
    midKey,
    ...generateNJitteredKeysBetween(midKey, upper, count - mid - 1, charset, random),
  ];
};

export const getIntegerPart = (orderKey: string, charset: Charset): string => {
  const head = integerHead(orderKey, charset);
  const length = integerLength(head, charset);
  if (length > orderKey.length) {
    throw new Error(`invalid order key length: ${orderKey}`);
  }
  return orderKey.slice(0, length);
};

export const incrementInteger = (integer: string, charset: Charset): string => {
  validateInteger(integer, charset);
  const [head, digits] = splitInteger(integer, charset);
  const maxChar = charset.byCode[charset.length - 1]!;
  if (digits !== maxChar.repeat(digits.length)) {
    return `${head}${addOne(digits, charset)}`;
  }
  return startOnNewHead(incrementIntegerHead(head, charset), "lower", charset);
};

export const decrementInteger = (integer: string, charset: Charset): string => {
  validateInteger(integer, charset);
  const [head, digits] = splitInteger(integer, charset);
  const minChar = charset.byCode[0]!;
  if (digits !== minChar.repeat(digits.length)) {
    return `${head}${subtractOne(digits, charset, false)}`;
  }
  return startOnNewHead(decrementIntegerHead(head, charset), "upper", charset);
};

export const midPoint = (lower: string, upper: string, charset: Charset): string => {
  let [paddedLower, paddedUpper] = makeSameLength(lower, upper, "end", charset.first);
  let distance = lexicalDistance(paddedLower, paddedUpper, charset);
  if (distance === 1) {
    paddedLower = `${paddedLower}${charset.first}`;
    distance = charset.length;
  }
  const mid = encodeToCharset(Math.floor(distance / 2), charset);
  return addCharsetKeys(paddedLower, mid, charset);
};

export const jitterString = (orderKey: string, charset: Charset, random: RandomSource): string => {
  const randomValue = random.next();
  if (randomValue < 0 || randomValue >= 1) {
    throw new Error(`random value out of range: ${randomValue}`);
  }
  return addCharsetKeys(
    orderKey,
    encodeToCharset(Math.floor(randomValue * charset.jitterRange), charset),
    charset,
  );
};

export const padAndJitterString = (
  orderKey: string,
  numberOfChars: number,
  charset: Charset,
  random: RandomSource,
): string => jitterString(`${orderKey}${charset.first.repeat(numberOfChars)}`, charset, random);

export const paddingNeededForDistance = (distance: number, charset: Charset): number => {
  const gap = charset.jitterRange - distance;
  for (const [key, value] of Object.entries(charset.paddingDict)) {
    if (value > gap) {
      return Number(key);
    }
  }
  return 0;
};

export const paddingNeededForJitter = (
  orderKey: string,
  upper: string | undefined,
  charset: Charset,
): number => {
  const integer = getIntegerPart(orderKey, charset);
  const nextInteger = incrementInteger(integer, charset);
  let needed = 0;

  if (upper !== undefined) {
    const distanceToUpper = lexicalDistance(orderKey, upper, charset);
    if (distanceToUpper < charset.jitterRange + 1) {
      needed = Math.max(needed, paddingNeededForDistance(distanceToUpper, charset));
    }
  }

  const distanceToNextInteger = lexicalDistance(orderKey, nextInteger, charset);
  if (distanceToNextInteger < charset.jitterRange + 1) {
    needed = Math.max(needed, paddingNeededForDistance(distanceToNextInteger, charset));
  }

  return needed;
};

const integerHead = (integer: string, charset: Charset): string => {
  if (integer.length === 0) return "";
  let index = 0;
  if (integer[0] === charset.mostPositive) {
    while (index < integer.length && integer[index] === charset.mostPositive) index += 1;
  }
  if (integer[0] === charset.mostNegative) {
    while (index < integer.length && integer[index] === charset.mostNegative) index += 1;
  }
  if (index >= integer.length) return integer;
  return integer.slice(0, index + 1);
};

const integerLengthFromSecondLevel = (
  key: string,
  direction: "positive" | "negative",
  charset: Charset,
): number => {
  if (key.length === 0) return 0;
  const firstChar = key[0]!;
  if (firstChar > charset.mostPositive || firstChar < charset.mostNegative) {
    throw new Error("invalid firstChar on key");
  }
  if (firstChar === charset.mostPositive && direction === "positive") {
    return (
      distanceBetween(firstChar, charset.mostNegative, charset) +
      1 +
      integerLengthFromSecondLevel(key.slice(1), direction, charset)
    );
  }
  if (firstChar === charset.mostNegative && direction === "negative") {
    return (
      distanceBetween(firstChar, charset.mostPositive, charset) +
      1 +
      integerLengthFromSecondLevel(key.slice(1), direction, charset)
    );
  }
  if (direction === "positive") {
    return distanceBetween(firstChar, charset.mostNegative, charset) + 2;
  }
  return distanceBetween(firstChar, charset.mostPositive, charset) + 2;
};

const integerLength = (head: string, charset: Charset): number => {
  if (head.length === 0) throw new Error("head cannot be empty");
  const firstChar = head[0]!;
  if (firstChar > charset.mostPositive || firstChar < charset.mostNegative) {
    throw new Error("invalid firstChar on key");
  }
  if (firstChar === charset.mostPositive) {
    return (
      distanceBetween(firstChar, charset.firstPositive, charset) +
      1 +
      integerLengthFromSecondLevel(head.slice(1), "positive", charset)
    );
  }
  if (firstChar === charset.mostNegative) {
    return (
      distanceBetween(firstChar, charset.firstNegative, charset) +
      1 +
      integerLengthFromSecondLevel(head.slice(1), "negative", charset)
    );
  }
  if (firstChar >= charset.firstPositive) {
    return distanceBetween(firstChar, charset.firstPositive, charset) + 2;
  }
  return distanceBetween(firstChar, charset.firstNegative, charset) + 2;
};

const validateInteger = (integer: string, charset: Charset): void => {
  if (integerLength(integer, charset) !== integer.length) {
    throw new Error(`invalid integer length: ${integer}`);
  }
};

const splitInteger = (integer: string, charset: Charset): [string, string] => {
  const head = integerHead(integer, charset);
  return [head, integer.slice(head.length)];
};

const incrementIntegerHead = (head: string, charset: Charset): string => {
  const inPositiveRange = head >= charset.firstPositive;
  const nextHead = addOne(head, charset);
  const headIsLimitMax = head.at(-1) === charset.mostPositive;
  const nextHeadIsLimitMax = nextHead.at(-1) === charset.mostPositive;

  if (inPositiveRange && nextHeadIsLimitMax) {
    return `${nextHead}${charset.mostNegative}`;
  }
  if (!inPositiveRange && headIsLimitMax) {
    return head.slice(0, -1);
  }
  return nextHead;
};

const decrementIntegerHead = (head: string, charset: Charset): string => {
  const inPositiveRange = head >= charset.firstPositive;
  const headIsLimitMin = head.at(-1) === charset.mostNegative;
  if (inPositiveRange && headIsLimitMin) {
    return subtractOne(head.slice(0, -1), charset, false);
  }
  if (!inPositiveRange && headIsLimitMin) {
    return `${head}${charset.mostPositive}`;
  }
  return subtractOne(head, charset, false);
};

const fillCharForLimit = (limit: "lower" | "upper", charset: Charset): string => {
  if (limit === "upper") {
    return charset.last;
  }
  return charset.first;
};

const startOnNewHead = (head: string, limit: "lower" | "upper", charset: Charset): string => {
  const newLength = integerLength(head, charset);
  const fillChar = fillCharForLimit(limit, charset);
  return `${head}${fillChar.repeat(newLength - head.length)}`;
};

const distanceBetween = (a: string, b: string, charset: Charset): number => {
  const indexA = charset.byChar[a];
  const indexB = charset.byChar[b];
  if (indexA === undefined || indexB === undefined) {
    throw new Error("invalid character in distance calculation");
  }
  return Math.abs(indexA - indexB);
};

const makeSameLength = (
  a: string,
  b: string,
  pad: "start" | "end",
  fill: string,
): [string, string] => {
  const maxLength = Math.max(a.length, b.length);
  if (pad === "start") {
    return [fill.repeat(maxLength - a.length) + a, fill.repeat(maxLength - b.length) + b];
  }
  return [a + fill.repeat(maxLength - a.length), b + fill.repeat(maxLength - b.length)];
};

const encodeToCharset = (value: number, charset: Charset): string => {
  if (value === 0) return charset.byCode[0]!;
  let result = "";
  let current = value;
  while (current > 0) {
    result = `${charset.byCode[current % charset.length]}${result}`;
    current = Math.floor(current / charset.length);
  }
  return result;
};

const decodeCharsetToNumber = (key: string, charset: Charset): number => {
  let result = 0;
  for (let index = 0; index < key.length; index += 1) {
    const power = key.length - index - 1;
    result += charset.byChar[key[index]!]! * pow(charset.length, power);
  }
  return result;
};

const addCharsetKeys = (a: string, b: string, charset: Charset): string => {
  const [paddedA, paddedB] = makeSameLength(a, b, "start", charset.first);
  const result: string[] = [];
  let carry = 0;
  for (let index = paddedA.length - 1; index >= 0; index -= 1) {
    const sum = charset.byChar[paddedA[index]!]! + charset.byChar[paddedB[index]!]! + carry;
    carry = Math.floor(sum / charset.length);
    result.push(charset.byCode[sum % charset.length]!);
  }
  if (carry > 0) {
    result.push(charset.byCode[carry]!);
  }
  return result.reverse().join("");
};

const subtractCharsetKeys = (
  a: string,
  b: string,
  charset: Charset,
  stripLeadingZeros: boolean,
): string => {
  const [paddedA, paddedB] = makeSameLength(a, b, "start", charset.first);
  const result: string[] = [];
  let borrow = 0;
  for (let index = paddedA.length - 1; index >= 0; index -= 1) {
    let digitA = charset.byChar[paddedA[index]!]!;
    const digitB = charset.byChar[paddedB[index]!]! + borrow;
    if (digitA < digitB) {
      borrow = 1;
      digitA += charset.length;
    } else {
      borrow = 0;
    }
    result.push(charset.byCode[digitA - digitB]!);
  }
  if (borrow > 0) throw new Error("subtraction result is negative");
  const normalized = result.reverse().join("");
  if (!stripLeadingZeros) return normalized;
  return normalized.replace(new RegExp(`^${charset.first}+`), "") || charset.first;
};

const addOne = (key: string, charset: Charset): string =>
  addCharsetKeys(key, charset.byCode[1]!, charset);

const subtractOne = (key: string, charset: Charset, stripLeadingZeros: boolean): string =>
  subtractCharsetKeys(key, charset.byCode[1]!, charset, stripLeadingZeros);

const orderPair = (a: string, b: string): [string, string] => {
  if (a > b) {
    return [b, a];
  }
  return [a, b];
};

const lexicalDistance = (a: string, b: string, charset: Charset): number => {
  const [paddedA, paddedB] = makeSameLength(a, b, "end", charset.first);
  const [lower, upper] = orderPair(paddedA, paddedB);
  return decodeCharsetToNumber(subtractCharsetKeys(upper, lower, charset, true), charset);
};

function buildPaddingDict(jitterRange: number, charsetLength: number): Record<number, number> {
  const padding: Record<number, number> = {};
  for (let index = 0; index < 100; index += 1) {
    const value = pow(charsetLength, index);
    padding[index] = value;
    if (value > jitterRange) break;
  }
  return padding;
}

function pow(base: number, exp: number): number {
  let result = 1;
  for (let index = 0; index < exp; index += 1) {
    result *= base;
  }
  return result;
}
