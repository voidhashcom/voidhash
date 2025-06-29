import { Db } from "@/lib/effect/db";
import { checkoutSessions, InsertCheckoutSession } from "@voidhash/db";
import { Effect } from "effect";

export class CheckoutSessionRepository extends Effect.Service<CheckoutSessionRepository>()(
	"CheckoutSessionRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
				createCheckoutSession: dbService.makeQuery(
					(execute, session: InsertCheckoutSession) =>
						execute(async (db) => 
							await db.insert(checkoutSessions).values(session)
						)
				),
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
