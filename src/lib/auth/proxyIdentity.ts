import { createHmac, timingSafeEqual } from "node:crypto";

export const PROXY_IDENTITY_HEADER = "x-rentapp-proxy-identity";

const MAX_AGE_MS = 90_000;

function getSigningSecret() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function sign(payload: string, secret: string) {
    return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createProxyIdentity(userId: string) {
    const secret = getSigningSecret();
    if (!secret) return null;

    const issuedAt = Date.now().toString();
    const payload = `${issuedAt}.${userId}`;
    return `${payload}.${sign(payload, secret)}`;
}

export function verifyProxyIdentity(value: string | null) {
    const secret = getSigningSecret();
    if (!secret || !value) return null;

    const [issuedAt, userId, signature, ...extra] = value.split(".");
    if (!issuedAt || !userId || !signature || extra.length > 0 || !/^\d+$/.test(issuedAt)) return null;

    const age = Date.now() - Number(issuedAt);
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;

    const payload = `${issuedAt}.${userId}`;
    const expected = Buffer.from(sign(payload, secret));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    return userId;
}
