// The legacy /api/posts endpoint remains a notice-only compatibility alias.
export { GET, POST } from '../posts/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
