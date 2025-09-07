import { setupServer } from '../../../../node_modules/msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
