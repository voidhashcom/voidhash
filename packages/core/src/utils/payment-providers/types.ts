export type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};

// export const createPaymentProviderApi = (api: {
// 	registerEndpoints: (app: App) => void;
// }) => {
// 	return api;
// };
