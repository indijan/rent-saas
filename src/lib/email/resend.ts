type SendEmailInput = {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendEmail({ to, subject, html, text }: SendEmailInput) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return { ok: false, error: "RESEND_API_KEY nincs beállítva." };
    }

    const from =
        process.env.RESEND_FROM ||
        "Albimenedzsment <no-reply@albimenedzsment.work.gd>";

    const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to,
            subject,
            html,
            text,
        }),
    });

    if (!res.ok) {
        const msg = await res.text();
        return { ok: false, error: msg || `Resend hiba: ${res.status}` };
    }

    return { ok: true };
}
