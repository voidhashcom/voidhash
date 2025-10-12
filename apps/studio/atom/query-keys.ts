const API = 'api';

const userKeys = {
  all: [API, 'users'],
  getUser: () => [...userKeys.all, 'getUser']
};

const organizationKeys = {
  all: [API, 'organizations'],
  getOrganization: (organizationId: string) => [
    ...organizationKeys.all,
    'getOrganization',
    organizationId
  ]
};

export const queryKeys = {
  invalidateAll: () => [API],
  user: userKeys,
  organization: organizationKeys
};
