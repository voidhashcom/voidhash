import { Db } from "@/lib/effect/db";
import {
	eq,
	InsertCustomerUnlockedPerk,
	CustomerUnlockedPerk,
	customerUnlockedPerks,
} from "@voidhash/db";
import { Effect } from "effect";

export class CustomerUnlockedPerkRepository extends Effect.Service<CustomerUnlockedPerkRepository>()(
	"CustomerUnlockedPerkRepository",
	{
		effect: Effect.gen(function* () {
			const dbService = yield* Db;
			return {
				createCustomerUnlockedPerk: dbService.makeQuery(
					(execute, customerUnlockedPerk: InsertCustomerUnlockedPerk) =>
						execute(
							async (db) =>
								await db
									.insert(customerUnlockedPerks)
									.values(customerUnlockedPerk)
						)
				),
				updateCustomerUnlockedPerk: dbService.makeQuery(
					(
						execute,
						customerUnlockedPerk: Omit<Partial<CustomerUnlockedPerk>, "id"> & {
							id: string;
						}
					) =>
						execute(
							async (db) =>
								await db
									.update(customerUnlockedPerks)
									.set(customerUnlockedPerk)
									.where(eq(customerUnlockedPerks.id, customerUnlockedPerk.id))
						)
				),
			};
		}),

		// Specify dependencies
		dependencies: [Db.Default],
	}
) {}
