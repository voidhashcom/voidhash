import { useQuery } from '@tanstack/react-query';
import { currentUserOptions } from '@/lib/tanstack-query/users';

export const useCurrentUser = () => useQuery(currentUserOptions());
