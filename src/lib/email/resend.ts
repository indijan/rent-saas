type SendEmailInput = {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
};

type SendEmailResult = {
    ok: boolean;
    error?: string;
};

function resolveFromAddress() {
    return process.env.EMAIL_FROM
        || "Rentapp.hu <no-reply@rentapp.hu>";
}

async function sendWithSes({ to, subject, html, text }: SendEmailInput): Promise<SendEmailResult> {
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

    const body = JSON.stringify({
        FromEmailAddress: resolveFromAddress(),
        Destination: {
            ToAddresses: Array.isArray(to) ? to : [to],
        },
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

    const res = await fetch(endpoint, {
        method: "POST",
        headers: signedRequest.headers as Record<string, string>,
        body,
    });

    if (!res.ok) {
        const msg = await res.text();
        return { ok: false, error: msg || `Amazon SES hiba: ${res.status}` };
    }

    return { ok: true };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    return sendWithSes(input);
}
