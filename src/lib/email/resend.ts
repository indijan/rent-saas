import { createEmailDeliveryLogs, type EmailLogContext } from "@/lib/emailLogs";

type SendEmailInput = {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    log?: EmailLogContext;
};

type SendEmailResult = {
    ok: boolean;
    error?: string;
    providerMessageId?: string;
};

function resolveFromAddress() {
    return process.env.EMAIL_FROM
        || "Rentapp.hu <no-reply@rentapp.hu>";
}

function buildEmailTags(log?: EmailLogContext) {
    if (!log) return undefined;

    return [
        { Name: "rentapp-category", Value: log.category.slice(0, 256) },
        { Name: "rentapp-owner-id", Value: log.ownerId.slice(0, 256) },
        ...(log.tenantId ? [{ Name: "rentapp-tenant-id", Value: log.tenantId.slice(0, 256) }] : []),
        ...(log.chargeId ? [{ Name: "rentapp-charge-id", Value: log.chargeId.slice(0, 256) }] : []),
        ...(log.propertyId ? [{ Name: "rentapp-property-id", Value: log.propertyId.slice(0, 256) }] : []),
        { Name: "rentapp-recipient-role", Value: (log.recipientRole ?? "TENANT").slice(0, 256) },
    ];
}

async function sendWithSes({ to, subject, html, text, log }: SendEmailInput): Promise<SendEmailResult> {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = process.env.AWS_SESSION_TOKEN;
    const region = process.env.AWS_REGION || "eu-west-1";

    if (!accessKeyId || !secretAccessKey) {
        return { ok: false, error: "Az Amazon SES-hez hiányzik az AWS_ACCESS_KEY_ID vagy AWS_SECRET_ACCESS_KEY." };
    }

    const { SignatureV4 } = await import("@aws-sdk/signature-v4");
    const { Sha256 } = await import("@aws-crypto/sha256-js");
    const { HttpRequest } = await import("@aws-sdk/protocol-http");

    const recipients = Array.isArray(to) ? to : [to];
    const emailTags = buildEmailTags(log);
    const body = JSON.stringify({
        FromEmailAddress: resolveFromAddress(),
        ...(process.env.SES_CONFIGURATION_SET ? { ConfigurationSetName: process.env.SES_CONFIGURATION_SET } : {}),
        Destination: {
            ToAddresses: recipients,
        },
        ...(emailTags ? { EmailTags: emailTags } : {}),
        Content: {
            Simple: {
                Subject: {
                    Data: subject,
                    Charset: "UTF-8",
                },
                Body: {
                    Html: {
                        Data: html,
                        Charset: "UTF-8",
                    },
                    ...(text ? {
                        Text: {
                            Data: text,
                            Charset: "UTF-8",
                        },
                    } : {}),
                },
            },
        },
    });

    const signer = new SignatureV4({
        credentials: {
            accessKeyId,
            secretAccessKey,
            ...(sessionToken ? { sessionToken } : {}),
        },
        region,
        service: "ses",
        sha256: Sha256,
    });

    const endpoint = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;
    const url = new URL(endpoint);
    const signedRequest = await signer.sign(new HttpRequest({
        protocol: url.protocol,
        hostname: url.hostname,
        method: "POST",
        path: url.pathname,
        headers: {
            "Content-Type": "application/json",
            host: url.hostname,
        },
        body,
    }));

    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: signedRequest.headers as Record<string, string>,
            body,
        });

        if (!res.ok) {
            const msg = await res.text();
            return { ok: false, error: msg || `Amazon SES hiba: ${res.status}` };
        }

        const payload = await res.json().catch(() => null) as { MessageId?: string } | null;
        return { ok: true, providerMessageId: payload?.MessageId };
    } catch (error: unknown) {
        return { ok: false, error: error instanceof Error ? error.message : "Ismeretlen Amazon SES hiba." };
    }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const recipients = Array.isArray(input.to) ? input.to : [input.to];
    const result = await sendWithSes(input);

    if (input.log) {
        await createEmailDeliveryLogs({
            recipients,
            subject: input.subject,
            context: input.log,
            status: result.ok ? "ACCEPTED" : "FAILED",
            providerMessageId: result.providerMessageId ?? null,
            errorMessage: result.error ?? null,
        });
    }

    return result;
}
