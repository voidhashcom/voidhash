import { db, product } from "@voidhash/db";
import { eq } from "drizzle-orm";

export const getProductsQuery = async (projectId: string) => {
	const products = db
		.select()
		.from(product)
		.where(eq(product.projectId, projectId));
	return products;
};

export const getProductByIdQuery = async (id: string) => {
	return db.select().from(product).where(eq(product.id, id));
};
