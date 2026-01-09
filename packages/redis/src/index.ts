import { Data, Effect } from "effect";
import type { RedisOptions } from "ioredis";
import Redis from "ioredis";

export class RedisError extends Data.TaggedError("RedisError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

type RedisClient = Redis;

export class RedisService extends Effect.Service<RedisService>()(
	"app/RedisService",
	{
		dependencies: [],
		scoped: Effect.gen(function* () {
			const redis = yield* Effect.acquireRelease(
				Effect.sync(() => {
					const client = new Redis({
						host: process.env.REDIS_HOST ?? "localhost",
						lazyConnect: true,
						port: Number(process.env.REDIS_PORT ?? 6379),
					});
					return client;
				}),
				(client) => Effect.promise(() => client.quit()),
			);

			yield* Effect.tryPromise({
				catch: (cause) =>
					new RedisError({
						cause,
						message: "Failed to connect to Redis",
					}),
				try: () => redis.connect(),
			});

			const use = <T,>(fn: (client: RedisClient) => Promise<T>) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: "Redis operation failed",
						}),
					try: () => fn(redis),
				});

			const get = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to get key: ${key}` }),
					try: () => redis.get(key),
				});

			const set = (
				key: string,
				value: string | number | Buffer,
				options?: { ex?: number; px?: number; nx?: boolean; xx?: boolean },
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to set key: ${key}` }),
					try: () => {
						if (options?.ex && options.nx) {
							return redis.set(key, value, "EX", options.ex, "NX");
						}
						if (options?.ex && options.xx) {
							return redis.set(key, value, "EX", options.ex, "XX");
						}
						if (options?.ex) {
							return redis.set(key, value, "EX", options.ex);
						}
						if (options?.px && options.nx) {
							return redis.set(key, value, "PX", options.px, "NX");
						}
						if (options?.px && options.xx) {
							return redis.set(key, value, "PX", options.px, "XX");
						}
						if (options?.px) {
							return redis.set(key, value, "PX", options.px);
						}
						if (options?.nx) {
							return redis.set(key, value, "NX");
						}
						if (options?.xx) {
							return redis.set(key, value, "XX");
						}
						return redis.set(key, value);
					},
				});

			const del = (...keys: string[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to delete keys" }),
					try: () => redis.del(...keys),
				});

			const exists = (...keys: string[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to check key existence" }),
					try: () => redis.exists(...keys),
				});

			const expire = (key: string, seconds: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to set expire on key: ${key}`,
						}),
					try: () => redis.expire(key, seconds),
				});

			const pexpire = (key: string, milliseconds: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to set pexpire on key: ${key}`,
						}),
					try: () => redis.pexpire(key, milliseconds),
				});

			const ttl = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to get TTL for key: ${key}`,
						}),
					try: () => redis.ttl(key),
				});

			const pttl = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to get PTTL for key: ${key}`,
						}),
					try: () => redis.pttl(key),
				});

			const keys = (pattern: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to get keys with pattern: ${pattern}`,
						}),
					try: () => redis.keys(pattern),
				});

			const mget = (...keys: string[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to mget keys" }),
					try: () => redis.mget(...keys),
				});

			const mset = (data: Record<string, string | number | Buffer>) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to mset keys" }),
					try: () => redis.mset(data),
				});

			const incr = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to incr key: ${key}` }),
					try: () => redis.incr(key),
				});

			const incrby = (key: string, increment: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to incrby key: ${key}` }),
					try: () => redis.incrby(key, increment),
				});

			const incrbyfloat = (key: string, increment: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to incrbyfloat key: ${key}`,
						}),
					try: () => redis.incrbyfloat(key, increment),
				});

			const decr = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to decr key: ${key}` }),
					try: () => redis.decr(key),
				});

			const decrby = (key: string, decrement: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to decrby key: ${key}` }),
					try: () => redis.decrby(key, decrement),
				});

			const hget = (key: string, field: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to hget ${field} from ${key}`,
						}),
					try: () => redis.hget(key, field),
				});

			const hset = (
				key: string,
				field: string,
				value: string | number | Buffer,
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to hset ${field} in ${key}`,
						}),
					try: () => redis.hset(key, field, value),
				});

			const hmset = (
				key: string,
				data: Record<string, string | number | Buffer>,
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to hmset in ${key}` }),
					try: () => redis.hmset(key, data),
				});

			const hgetall = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to hgetall from ${key}` }),
					try: () => redis.hgetall(key),
				});

			const hdel = (key: string, ...fields: string[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to hdel from ${key}` }),
					try: () => redis.hdel(key, ...fields),
				});

			const hexists = (key: string, field: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to hexists ${field} in ${key}`,
						}),
					try: () => redis.hexists(key, field),
				});

			const hkeys = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to hkeys from ${key}` }),
					try: () => redis.hkeys(key),
				});

			const hvals = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to hvals from ${key}` }),
					try: () => redis.hvals(key),
				});

			const hlen = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to hlen from ${key}` }),
					try: () => redis.hlen(key),
				});

			const hincrby = (key: string, field: string, increment: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to hincrby ${field} in ${key}`,
						}),
					try: () => redis.hincrby(key, field, increment),
				});

			const hincrbyfloat = (key: string, field: string, increment: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to hincrbyfloat ${field} in ${key}`,
						}),
					try: () => redis.hincrbyfloat(key, field, increment),
				});

			const lpush = (key: string, ...values: (string | number | Buffer)[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to lpush to ${key}` }),
					try: () => redis.lpush(key, ...values),
				});

			const rpush = (key: string, ...values: (string | number | Buffer)[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to rpush to ${key}` }),
					try: () => redis.rpush(key, ...values),
				});

			const lpop = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to lpop from ${key}` }),
					try: () => redis.lpop(key),
				});

			const lpopCount = (key: string, count: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to lpop from ${key}` }),
					try: () => redis.lpop(key, count),
				});

			const rpop = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to rpop from ${key}` }),
					try: () => redis.rpop(key),
				});

			const rpopCount = (key: string, count: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to rpop from ${key}` }),
					try: () => redis.rpop(key, count),
				});

			const lrange = (key: string, start: number, stop: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to lrange from ${key}` }),
					try: () => redis.lrange(key, start, stop),
				});

			const llen = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to llen from ${key}` }),
					try: () => redis.llen(key),
				});

			const lindex = (key: string, index: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to lindex from ${key}` }),
					try: () => redis.lindex(key, index),
				});

			const lset = (
				key: string,
				index: number,
				value: string | number | Buffer,
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to lset in ${key}` }),
					try: () => redis.lset(key, index, value),
				});

			const ltrim = (key: string, start: number, stop: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to ltrim ${key}` }),
					try: () => redis.ltrim(key, start, stop),
				});

			const sadd = (key: string, ...members: (string | number | Buffer)[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to sadd to ${key}` }),
					try: () => redis.sadd(key, ...members),
				});

			const srem = (key: string, ...members: (string | number | Buffer)[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to srem from ${key}` }),
					try: () => redis.srem(key, ...members),
				});

			const smembers = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to smembers from ${key}`,
						}),
					try: () => redis.smembers(key),
				});

			const sismember = (key: string, member: string | number | Buffer) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to sismember in ${key}` }),
					try: () => redis.sismember(key, member),
				});

			const scard = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to scard from ${key}` }),
					try: () => redis.scard(key),
				});

			const sinter = (...keys: string[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to sinter" }),
					try: () => redis.sinter(...keys),
				});

			const sunion = (...keys: string[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to sunion" }),
					try: () => redis.sunion(...keys),
				});

			const sdiff = (...keys: string[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to sdiff" }),
					try: () => redis.sdiff(...keys),
				});

			const zadd = (key: string, ...args: (string | number | Buffer)[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to zadd to ${key}` }),
					try: () => redis.zadd(key, ...(args as [number, string])),
				});

			const zrem = (key: string, ...members: (string | number | Buffer)[]) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to zrem from ${key}` }),
					try: () => redis.zrem(key, ...members),
				});

			const zrange = (
				key: string,
				start: number,
				stop: number,
				options?: { withScores?: boolean },
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to zrange from ${key}` }),
					try: () =>
						options?.withScores
							? redis.zrange(key, start, stop, "WITHSCORES")
							: redis.zrange(key, start, stop),
				});

			const zrevrange = (
				key: string,
				start: number,
				stop: number,
				options?: { withScores?: boolean },
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to zrevrange from ${key}`,
						}),
					try: () =>
						options?.withScores
							? redis.zrevrange(key, start, stop, "WITHSCORES")
							: redis.zrevrange(key, start, stop),
				});

			const zrangebyscore = (
				key: string,
				min: number | string,
				max: number | string,
				options?: {
					withScores?: boolean;
					limit?: { offset: number; count: number };
				},
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to zrangebyscore from ${key}`,
						}),
					try: () => {
						const args: (string | number)[] = [key, min, max];
						if (options?.withScores) args.push("WITHSCORES");
						if (options?.limit) {
							args.push("LIMIT", options.limit.offset, options.limit.count);
						}
						return redis.zrangebyscore(...(args as [string, number, number]));
					},
				});

			const zscore = (key: string, member: string | number | Buffer) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to zscore from ${key}` }),
					try: () => redis.zscore(key, member),
				});

			const zcard = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to zcard from ${key}` }),
					try: () => redis.zcard(key),
				});

			const zcount = (
				key: string,
				min: number | string,
				max: number | string,
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to zcount from ${key}` }),
					try: () => redis.zcount(key, min, max),
				});

			const zincrby = (
				key: string,
				increment: number,
				member: string | number | Buffer,
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to zincrby in ${key}` }),
					try: () => redis.zincrby(key, increment, member),
				});

			const zrank = (key: string, member: string | number | Buffer) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to zrank from ${key}` }),
					try: () => redis.zrank(key, member),
				});

			const zrevrank = (key: string, member: string | number | Buffer) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to zrevrank from ${key}`,
						}),
					try: () => redis.zrevrank(key, member),
				});

			const publish = (channel: string, message: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to publish to ${channel}`,
						}),
					try: () => redis.publish(channel, message),
				});

			const setex = (
				key: string,
				seconds: number,
				value: string | number | Buffer,
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to setex key: ${key}` }),
					try: () => redis.setex(key, seconds, value),
				});

			const psetex = (
				key: string,
				milliseconds: number,
				value: string | number | Buffer,
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to psetex key: ${key}` }),
					try: () => redis.psetex(key, milliseconds, value),
				});

			const setnx = (key: string, value: string | number | Buffer) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to setnx key: ${key}` }),
					try: () => redis.setnx(key, value),
				});

			const getset = (key: string, value: string | number | Buffer) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to getset key: ${key}` }),
					try: () => redis.getset(key, value),
				});

			const append = (key: string, value: string | number | Buffer) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to append to key: ${key}`,
						}),
					try: () => redis.append(key, value),
				});

			const strlen = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to strlen key: ${key}` }),
					try: () => redis.strlen(key),
				});

			const getrange = (key: string, start: number, end: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to getrange key: ${key}`,
						}),
					try: () => redis.getrange(key, start, end),
				});

			const setrange = (
				key: string,
				offset: number,
				value: string | number | Buffer,
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to setrange key: ${key}`,
						}),
					try: () => redis.setrange(key, offset, value),
				});

			const ping = () =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to ping" }),
					try: () => redis.ping(),
				});

			const flushdb = () =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to flushdb" }),
					try: () => redis.flushdb(),
				});

			const flushall = () =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to flushall" }),
					try: () => redis.flushall(),
				});

			const dbsize = () =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to dbsize" }),
					try: () => redis.dbsize(),
				});

			const type = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to get type for key: ${key}`,
						}),
					try: () => redis.type(key),
				});

			const rename = (key: string, newKey: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to rename key: ${key}` }),
					try: () => redis.rename(key, newKey),
				});

			const renamenx = (key: string, newKey: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to renamenx key: ${key}`,
						}),
					try: () => redis.renamenx(key, newKey),
				});

			const persist = (key: string) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to persist key: ${key}` }),
					try: () => redis.persist(key),
				});

			const expireat = (key: string, timestamp: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to expireat key: ${key}`,
						}),
					try: () => redis.expireat(key, timestamp),
				});

			const pexpireat = (key: string, timestamp: number) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: `Failed to pexpireat key: ${key}`,
						}),
					try: () => redis.pexpireat(key, timestamp),
				});

			const scan = (
				cursor: number | string,
				options?: { match?: string; count?: number },
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: "Failed to scan" }),
					try: () => {
						if (options?.match && options.count) {
							return redis.scan(
								cursor,
								"MATCH",
								options.match,
								"COUNT",
								options.count,
							);
						}
						if (options?.match) {
							return redis.scan(cursor, "MATCH", options.match);
						}
						if (options?.count) {
							return redis.scan(cursor, "COUNT", options.count);
						}
						return redis.scan(cursor);
					},
				});

			const hscan = (
				key: string,
				cursor: number | string,
				options?: { match?: string; count?: number },
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to hscan key: ${key}` }),
					try: () => {
						if (options?.match && options.count) {
							return redis.hscan(
								key,
								cursor,
								"MATCH",
								options.match,
								"COUNT",
								options.count,
							);
						}
						if (options?.match) {
							return redis.hscan(key, cursor, "MATCH", options.match);
						}
						if (options?.count) {
							return redis.hscan(key, cursor, "COUNT", options.count);
						}
						return redis.hscan(key, cursor);
					},
				});

			const sscan = (
				key: string,
				cursor: number | string,
				options?: { match?: string; count?: number },
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to sscan key: ${key}` }),
					try: () => {
						if (options?.match && options.count) {
							return redis.sscan(
								key,
								cursor,
								"MATCH",
								options.match,
								"COUNT",
								options.count,
							);
						}
						if (options?.match) {
							return redis.sscan(key, cursor, "MATCH", options.match);
						}
						if (options?.count) {
							return redis.sscan(key, cursor, "COUNT", options.count);
						}
						return redis.sscan(key, cursor);
					},
				});

			const zscan = (
				key: string,
				cursor: number | string,
				options?: { match?: string; count?: number },
			) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({ cause, message: `Failed to zscan key: ${key}` }),
					try: () => {
						if (options?.match && options.count) {
							return redis.zscan(
								key,
								cursor,
								"MATCH",
								options.match,
								"COUNT",
								options.count,
							);
						}
						if (options?.match) {
							return redis.zscan(key, cursor, "MATCH", options.match);
						}
						if (options?.count) {
							return redis.zscan(key, cursor, "COUNT", options.count);
						}
						return redis.zscan(key, cursor);
					},
				});

			const multi = () => redis.multi();

			const pipeline = () => redis.pipeline();

			const exec = (multi: ReturnType<typeof redis.multi>) =>
				Effect.tryPromise({
					catch: (cause) =>
						new RedisError({
							cause,
							message: "Failed to execute multi/pipeline",
						}),
					try: () => multi.exec(),
				});

			return {
				append,
				dbsize,
				decr,
				decrby,
				del,
				exec,
				exists,
				expire,
				expireat,
				flushall,
				flushdb,
				get,
				getrange,
				getset,
				hdel,
				hexists,
				hget,
				hgetall,
				hincrby,
				hincrbyfloat,
				hkeys,
				hlen,
				hmset,
				hscan,
				hset,
				hvals,
				incr,
				incrby,
				incrbyfloat,
				keys,
				lindex,
				llen,
				lpop,
				lpopCount,
				lpush,
				lrange,
				lset,
				ltrim,
				mget,
				mset,
				multi,
				persist,
				pexpire,
				pexpireat,
				ping,
				pipeline,
				psetex,
				pttl,
				publish,
				rename,
				renamenx,
				rpop,
				rpopCount,
				rpush,
				sadd,
				scan,
				scard,
				sdiff,
				set,
				setex,
				setnx,
				setrange,
				sinter,
				sismember,
				smembers,
				srem,
				sscan,
				strlen,
				sunion,
				ttl,
				type,
				use,
				zadd,
				zcard,
				zcount,
				zincrby,
				zrange,
				zrangebyscore,
				zrank,
				zrem,
				zrevrange,
				zrevrank,
				zscan,
				zscore,
			};
		}),
	},
) {}

export const makeRedisService = (options?: RedisOptions) =>
	Effect.Service<typeof RedisService>()("app/RedisService", {
		dependencies: [],
		scoped: Effect.gen(function* () {
			const redis = yield* Effect.acquireRelease(
				Effect.sync(() => {
					const client = new Redis({
						host: options?.host ?? process.env.REDIS_HOST ?? "localhost",
						lazyConnect: true,
						port: options?.port ?? Number(process.env.REDIS_PORT ?? 6379),
						...options,
					});
					return client;
				}),
				(client) => Effect.promise(() => client.quit()),
			);

			yield* Effect.tryPromise({
				catch: (cause) =>
					new RedisError({
						cause,
						message: "Failed to connect to Redis",
					}),
				try: () => redis.connect(),
			});

			return yield* RedisService;
		}),
	});

export { Redis, type RedisOptions };
