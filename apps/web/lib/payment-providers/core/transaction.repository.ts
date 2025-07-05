import { Db } from "@/lib/effect/db";
import { InsertTransaction, transactions } from "@voidhash/db";
import { Effect } from "effect";

export class TransactionRepository extends Effect.Service<TransactionRepository>()(
	"TransactionRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
				createTransaction: dbService.makeQuery(
					(execute, input: InsertTransaction) =>
						execute(async (db) => await db.insert(transactions).values(input))
				),
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
