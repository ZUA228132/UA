
import crypto from 'crypto';

export function verifyInitData(initData: string | null, botToken: string): { ok: boolean, userId?: number, username?: string, startParam?: string } {
  if (!initData) return { ok: false };
  const url = new URLSearchParams(initData);
  const hash = url.get('hash') || '';
  url.delete('hash');
  url.sort();
  const parts: string[] = [];
  for (const [k, v] of url.entries()) parts.push(`${k}=${v}`);
  const dataCheckString = parts.join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const ok = crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(hash, 'hex'));

  let userId: number | undefined; let username: string | undefined;
  let startParam: string | undefined;
  const userStr = url.get('user');
  if (userStr) { try { const u = JSON.parse(userStr); if (typeof u?.id === 'number') userId = u.id; if (typeof u?.username === 'string') username = u.username; } catch {} }
  const sp = url.get('start_param'); if (sp) startParam = sp;
  return { ok, userId, username, startParam };
}

export function isAdmin(userId?: number, adminSecret?: string, providedSecret?: string): boolean {
  if (providedSecret && adminSecret && providedSecret === adminSecret) return true;
  const allow = (process.env.ADMIN_ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!userId) return false;
  return allow.includes(String(userId));
}

export function isAllowedUser(_userId?: number): boolean {
  // allow everyone with valid signature (you control bot link)
  return true;
}
