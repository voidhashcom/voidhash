import { setupChiron } from "chiron-sh";

export const chiron = setupChiron({
	authenticate: async (options) => {
		return {
			id: "1",
			email: "test@test.com",
			name: "Test User",
		};
	},
});
