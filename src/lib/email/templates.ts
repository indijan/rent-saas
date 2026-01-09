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

type TenantInviteInput = {
    tenantEmail: string;
    tenantName?: string | null;
    inviteLink: string;
};

type ImportInvoiceStatusInput = {
    ownerEmail: string;
    status: "SUCCESS" | "FAILED";
    provider?: string | null;
    amount?: number | null;
    currency?: string | null;
    dueDate?: string | null;
    propertyName?: string | null;
    fileName?: string | null;
    error?: string | null;
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

export function renderTenantInviteEmail(input: TenantInviteInput) {
    const subject = "Belépési meghívó";
    const nameLine = input.tenantName ? `Szia ${input.tenantName},` : "Szia,";
    const text = [
        nameLine,
        "Létrehoztuk a bérlői fiókodat.",
        "Az aktiváláshoz nyisd meg az alábbi meghívó linket, ezzel belépsz:",
        input.inviteLink,
        `Jelszó beállítása belépés után: ${SITE_URL}/account`,
    ].join("\n");

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>${nameLine}</p>
            <p>Létrehoztuk a bérlői fiókodat.</p>
            <p>
                Az aktiváláshoz nyisd meg ezt a meghívó linket, ezzel belépsz:
                <br />
                <a href="${input.inviteLink}">Meghívó link megnyitása</a>
            </p>
            <p>Jelszó beállítása belépés után: <a href="${SITE_URL}/account">${SITE_URL}/account</a></p>
        </div>
    `;

    return { to: input.tenantEmail, subject, html, text };
}

export function renderImportInvoiceStatusEmail(input: ImportInvoiceStatusInput) {
    const subject = `Számla import ${input.status}`;
    const text = [
        `Státusz: ${input.status}`,
        input.fileName ? `Fájl: ${input.fileName}` : null,
        input.propertyName ? `Ingatlan: ${input.propertyName}` : null,
        input.provider ? `Szolgáltató: ${input.provider}` : null,
        input.amount !== null && input.amount !== undefined ? `Összeg: ${input.amount} ${input.currency ?? ""}` : null,
        input.dueDate ? `Határidő: ${input.dueDate}` : null,
        input.error ? `Hiba: ${input.error}` : null,
        `Részletek: ${SITE_URL}/owner/properties`,
    ].filter(Boolean).join("\n");

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Számla import: ${input.status}</h2>
            <ul>
                ${input.fileName ? `<li><b>Fájl:</b> ${input.fileName}</li>` : ""}
                ${input.propertyName ? `<li><b>Ingatlan:</b> ${input.propertyName}</li>` : ""}
                ${input.provider ? `<li><b>Szolgáltató:</b> ${input.provider}</li>` : ""}
                ${input.amount !== null && input.amount !== undefined ? `<li><b>Összeg:</b> ${input.amount} ${input.currency ?? ""}</li>` : ""}
                ${input.dueDate ? `<li><b>Határidő:</b> ${input.dueDate}</li>` : ""}
                ${input.error ? `<li><b>Hiba:</b> ${input.error}</li>` : ""}
            </ul>
            <p><a href="${SITE_URL}/owner/properties">Részletek megnyitása</a></p>
        </div>
    `;

    return { to: input.ownerEmail, subject, html, text };
}
