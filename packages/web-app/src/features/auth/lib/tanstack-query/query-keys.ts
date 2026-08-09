const userApiKeyKeys = {
  all: ["userApiKeys"] as const,
  list: () => [...userApiKeyKeys.all, "list"] as const,
};

export const queryKeys = {
  invalidateAll: () => [],
  userApiKey: userApiKeyKeys,
};
