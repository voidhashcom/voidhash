import { ID_BLACKLIST } from './id-blacklist';

export const SLUG_BLACKLIST = [
  ...ID_BLACKLIST,
  '~',
  'login',
  'sign-up',
  'auth'
];
