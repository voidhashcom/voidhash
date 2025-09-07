import { handle } from 'hono/vercel';
import { app } from '@/lib/api/api';

export const runtime = 'nodejs';

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
