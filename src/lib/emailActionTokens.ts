import { createHmac, timingSafeEqual } from "crypto";

type EmailActionType = "charge_mark_paid" | "charge_send_reminder" | "charge_publish";

type EmailActionPayload = {
    action: EmailActionType;
    chargeId: string;
    exp: number;
};

function getSecret() {
    const secret = process.env.EMAIL_ACTION_SECRET || process.env.INBOUND_PROCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret) {
        throw new Error("Hiányzik az EMAIL_ACTION_SECRET vagy egy fallback secret.");
    }
    return secret;
}

function toBase64Url(value: string) {
    return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
    return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(encodedPayload: string) {
    return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

export function createEmailActionToken(action: EmailActionType, chargeId: string, expiresInSeconds = 60 * 60 * 24 * 7) {
    const payload: EmailActionPayload = {
        action,
        chargeId,
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    };

    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = signValue(encodedPayload);
    return `${encodedPayload}.${signature}`;
}

export function verifyEmailActionToken(token: string): EmailActionPayload | null {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return null;

    const expectedSignature = signValue(encodedPayload);
    const expectedBuffer = Buffer.from(expectedSignature);
    const actualBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== actualBuffer.length) return null;
    if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

    try {
        const payload = JSON.parse(fromBase64Url(encodedPayload)) as EmailActionPayload;
        if (!payload?.action || !payload?.chargeId || !payload?.exp) return null;
        if (payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}
