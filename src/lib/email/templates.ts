const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://albimenedzsment.work.gd";

type NewChargeInput = {
    tenantEmail: string;
    title: string;
    amount: number;
    currency: string;
    dueDate: string;
    propertyName?: string | null;
    count?: number;
};

type ReminderInput = {
    tenantEmail: string;
    title: string;
    amount: number;
    currency: string;
    dueDate: string;
    propertyName?: string | null;
};

export function renderNewChargeEmail(input: NewChargeInput) {
    const countText = input.count && input.count > 1 ? ` (${input.count} alkalom)` : "";
    const propertyLine = input.propertyName ? `Ingatlan: ${input.propertyName}` : "Ingatlan: -";
    const subject = `Új díj rögzítve${countText}`;
    const text = [
        "Új díj került rögzítésre.",
        propertyLine,
        `Megnevezés: ${input.title}`,
        `Összeg: ${input.amount} ${input.currency}`,
        `Esedékes: ${input.dueDate}`,
        `Részletek: ${SITE_URL}/tenant/charges`,
    ].join("\n");

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Új díj került rögzítésre${countText}</h2>
            <p>${propertyLine}</p>
            <ul>
                <li><b>Megnevezés:</b> ${input.title}</li>
                <li><b>Összeg:</b> ${input.amount} ${input.currency}</li>
                <li><b>Esedékes:</b> ${input.dueDate}</li>
            </ul>
            <p><a href="${SITE_URL}/tenant/charges">Részletek megnyitása</a></p>
        </div>
    `;

    return { to: input.tenantEmail, subject, html, text };
}

export function renderReminderEmail(input: ReminderInput) {
    const propertyLine = input.propertyName ? `Ingatlan: ${input.propertyName}` : "Ingatlan: -";
    const subject = "Fizetési emlékeztető";
    const text = [
        "Fizetési emlékeztető: 2 nap múlva esedékes díj.",
        propertyLine,
        `Megnevezés: ${input.title}`,
        `Összeg: ${input.amount} ${input.currency}`,
        `Esedékes: ${input.dueDate}`,
        `Részletek: ${SITE_URL}/tenant/charges`,
    ].join("\n");

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Fizetési emlékeztető</h2>
            <p>2 nap múlva esedékes díj.</p>
            <p>${propertyLine}</p>
            <ul>
                <li><b>Megnevezés:</b> ${input.title}</li>
                <li><b>Összeg:</b> ${input.amount} ${input.currency}</li>
                <li><b>Esedékes:</b> ${input.dueDate}</li>
            </ul>
            <p><a href="${SITE_URL}/tenant/charges">Részletek megnyitása</a></p>
        </div>
    `;

    return { to: input.tenantEmail, subject, html, text };
}
