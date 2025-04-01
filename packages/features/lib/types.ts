export type QueryData<T extends (...args: any[]) => Promise<any>> = Awaited<
	ReturnType<T>
>;
