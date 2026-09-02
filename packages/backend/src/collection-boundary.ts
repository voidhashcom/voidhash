import * as Arr from "effect/Array";
import * as Eq from "effect/Equal";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const iterable = <A>(iterator: Iterator<A>): Iterable<A> => ({
  [Symbol.iterator]: () => iterator,
});

const contains = (values: ReadonlySetLike<unknown>, target: unknown): boolean =>
  Arr.some(Arr.fromIterable(iterable(values.keys())), (value) => Eq.equals(value, target));

function overlap<A, B>(value: A): A & B;
function overlap(value: unknown): unknown {
  return value;
}

/** Mutable Effect-backed map for adapters that require a map-shaped interface. */
export class MutableMap<K = never, V = never> implements Map<K, V> {
  readonly #values: MutableHashMap.MutableHashMap<K, V>;

  constructor(entries: Iterable<readonly [K, V]> = []) {
    this.#values = MutableHashMap.fromIterable(entries);
  }

  get size(): number {
    return MutableHashMap.size(this.#values);
  }

  get [Symbol.toStringTag](): string {
    return "Map";
  }

  clear(): void {
    MutableHashMap.clear(this.#values);
  }

  delete(key: K): boolean {
    const present = MutableHashMap.has(this.#values, key);
    MutableHashMap.remove(this.#values, key);
    return present;
  }

  get(key: K): V | typeof Schema.Undefined.Type {
    return Option.getOrUndefined(MutableHashMap.get(this.#values, key));
  }

  has(key: K): boolean {
    return MutableHashMap.has(this.#values, key);
  }

  set(key: K, value: V): this {
    MutableHashMap.set(this.#values, key, value);
    return this;
  }

  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: unknown): void {
    Arr.forEach(Arr.fromIterable(this.#values), ([key, value]) =>
      callbackfn.call(thisArg, value, key, this),
    );
  }

  getOrInsert(key: K, defaultValue: V): V {
    const current = this.get(key);
    if (current !== undefined) return current;
    this.set(key, defaultValue);
    return defaultValue;
  }

  getOrInsertComputed(key: K, callbackfn: (key: K) => V): V {
    const current = this.get(key);
    if (current !== undefined) return current;
    const value = callbackfn(key);
    this.set(key, value);
    return value;
  }

  entries(): MapIterator<[K, V]> {
    return Arr.fromIterable(this.#values).values();
  }

  keys(): MapIterator<K> {
    return Arr.map(Arr.fromIterable(this.#values), ([key]) => key).values();
  }

  values(): MapIterator<V> {
    return Arr.map(Arr.fromIterable(this.#values), ([, value]) => value).values();
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }
}

/** Mutable Effect-backed set for adapters that require a set-shaped interface. */
export class MutableSet<V = never> implements Set<V> {
  readonly #values: MutableHashSet.MutableHashSet<V>;

  constructor(values: Iterable<V> = []) {
    this.#values = MutableHashSet.fromIterable(values);
  }

  get size(): number {
    return MutableHashSet.size(this.#values);
  }

  get [Symbol.toStringTag](): string {
    return "Set";
  }

  add(value: V): this {
    MutableHashSet.add(this.#values, value);
    return this;
  }

  clear(): void {
    MutableHashSet.clear(this.#values);
  }

  delete(value: V): boolean {
    const present = this.has(value);
    MutableHashSet.remove(this.#values, value);
    return present;
  }

  has(value: V): boolean {
    return MutableHashSet.has(this.#values, value);
  }

  forEach(callbackfn: (value: V, value2: V, set: Set<V>) => void, thisArg?: unknown): void {
    Arr.forEach(Arr.fromIterable(this.#values), (value) =>
      callbackfn.call(thisArg, value, value, this),
    );
  }

  entries(): SetIterator<[V, V]> {
    return Arr.map(Arr.fromIterable(this.#values), (value): [V, V] => [value, value]).values();
  }

  keys(): SetIterator<V> {
    return this.values();
  }

  values(): SetIterator<V> {
    return Arr.fromIterable(this.#values).values();
  }

  union<U>(other: ReadonlySetLike<U>): Set<V | U> {
    const result = new MutableSet<V | U>(this);
    Arr.forEach(Arr.fromIterable(iterable(other.keys())), (value) => result.add(value));
    return result;
  }

  intersection<U>(other: ReadonlySetLike<U>): Set<V & U> {
    const result = new MutableSet<V & U>();
    Arr.forEach(
      Arr.filter(Arr.fromIterable(this), (value) => contains(other, value)),
      (value) => result.add(overlap<V, U>(value)),
    );
    return result;
  }

  difference<U>(other: ReadonlySetLike<U>): Set<V> {
    const result = new MutableSet<V>();
    Arr.forEach(
      Arr.filter(Arr.fromIterable(this), (value) => !contains(other, value)),
      (value) => result.add(value),
    );
    return result;
  }

  symmetricDifference<U>(other: ReadonlySetLike<U>): Set<V | U> {
    const result = new MutableSet<V | U>();
    Arr.forEach(
      Arr.filter(Arr.fromIterable(this), (value) => !contains(other, value)),
      (value) => result.add(value),
    );
    Arr.forEach(
      Arr.filter(Arr.fromIterable(iterable(other.keys())), (value) => !contains(this, value)),
      (value) => result.add(value),
    );
    return result;
  }

  isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
    return Arr.every(Arr.fromIterable(this), (value) => other.has(value));
  }

  isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
    return Arr.every(Arr.fromIterable(iterable(other.keys())), (value) => contains(this, value));
  }

  isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
    return Arr.every(Arr.fromIterable(this), (value) => !other.has(value));
  }

  [Symbol.iterator](): SetIterator<V> {
    return this.values();
  }
}
