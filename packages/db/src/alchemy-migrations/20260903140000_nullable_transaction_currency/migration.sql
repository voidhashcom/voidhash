-- A provider event without a price breakdown used to be stored as a zero
-- amount in an invented "USD". Absent money is now represented by a NULL
-- currency (amounts stay zero) so readers can tell "no amount reported"
-- from "amount was zero", and a later event carrying the money backfills it.
ALTER TABLE "transaction" ALTER COLUMN "currency" DROP NOT NULL;
