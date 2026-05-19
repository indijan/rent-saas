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

type OwnerOverdueCheckInput = {
    ownerEmail: string;
    ownerName?: string | null;
    tenantName?: string | null;
    title: string;
    amount: number;
    currency: string;
    dueDate: string;
    propertyName?: string | null;
    markPaidUrl?: string | null;
    sendReminderUrl?: string | null;
    openUrl?: string | null;
};

type FriendlyArrearsReminderInput = {
    tenantEmail: string;
    tenantName?: string | null;
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
    existingAccount?: boolean;
};

type OwnerInviteInput = {
    ownerEmail: string;
    ownerName?: string | null;
    inviteLink: string;
    existingAccount?: boolean;
};

type ImportInvoiceStatusInput = {
    ownerEmail: string;
    status: "SUCCESS" | "SUCCESS_DRAFT" | "FAILED";
    provider?: string | null;
    amount?: number | null;
    currency?: string | null;
    dueDate?: string | null;
    propertyName?: string | null;
    fileName?: string | null;
    error?: string | null;
    openUrl?: string | null;
    publishUrl?: string | null;
    reviewUrl?: string | null;
    chargeUrl?: string | null;
};

function renderActionButtons(actions: Array<{ label: string; href: string; primary?: boolean }>) {
    if (actions.length === 0) return "";
    return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
            <tr>
                ${actions.map((action) => `
                    <td style="padding:0 12px 12px 0;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                                <td style="border-radius:999px;${action.primary ? "background:#2563eb;" : "background:#ffffff;border:1px solid rgba(18,24,31,0.12);"}">
                                    <a
                                        href="${action.href}"
                                        style="
                                            display:inline-block;
                                            padding:12px 18px;
                                            border-radius:999px;
                                            text-decoration:none;
                                            font-weight:700;
                                            white-space:nowrap;
                                            ${action.primary ? "color:#ffffff;" : "color:#1f2937;"}
                                        "
                                    >${action.label}</a>
                                </td>
                            </tr>
                        </table>
                    </td>
                `).join("")}
            </tr>
        </table>
    `;
}

type OwnerLeadInput = {
    ownerEmail: string;
    fullName: string;
    companyName?: string | null;
    email: string;
    phone: string;
    billingAddress: string;
};

type TenantDeletionRequestInput = {
    ownerEmail: string;
    ownerName?: string | null;
    tenantName?: string | null;
    tenantEmail: string;
};

type TenantExitRequestInput = {
    ownerEmail: string;
    ownerName?: string | null;
    tenantName?: string | null;
    tenantEmail: string;
    propertyName: string;
    propertyAddress?: string | null;
    openUrl: string;
};

type UnknownInboundInvoiceInput = {
    ownerEmail: string;
    ownerName?: string | null;
    sourceEmailFrom?: string | null;
    fileName?: string | null;
    propertyName?: string | null;
    approveUrl: string;
    rejectUrl: string;
    reviewUrl: string;
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

export function renderOwnerOverdueCheckEmail(input: OwnerOverdueCheckInput) {
    const nameLine = input.ownerName ? `Szia ${input.ownerName},` : "Szia,";
    const propertyLine = input.propertyName ? `Ingatlan: ${input.propertyName}` : "Ingatlan: -";
    const subject = "Lejárt, nyitott díj ellenőrzése szükséges";
    const text = [
        nameLine,
        "A rendszerben az alábbi díj lejártként és továbbra is nyitottként szerepel.",
        input.tenantName ? `Bérlő: ${input.tenantName}` : null,
        "Ha a bérlő már fizetett, állítsd át a státuszt befizetettre. Ha még nem, a rendszerből egy gombnyomással tudsz baráti emlékeztetőt küldeni.",
        propertyLine,
        `Megnevezés: ${input.title}`,
        `Összeg: ${input.amount} ${input.currency}`,
        `Esedékesség: ${input.dueDate}`,
        `Teendők: ${input.openUrl || `${SITE_URL}/owner/todo`}`,
    ].filter(Boolean).join("\n");

    const actionButtons = renderActionButtons([
        input.markPaidUrl ? { label: "Fizetve", href: input.markPaidUrl, primary: true } : null,
        input.sendReminderUrl ? { label: "Baráti emlékeztetőt küldök", href: input.sendReminderUrl } : null,
        { label: "Megnyitom az appban", href: input.openUrl || `${SITE_URL}/owner/todo` },
    ].filter(Boolean) as Array<{ label: string; href: string; primary?: boolean }>);

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>${nameLine}</p>
            <p>A rendszerben az alábbi díj lejártként és továbbra is nyitottként szerepel.</p>
            <p>Ha a bérlő már fizetett, állítsd át a státuszt befizetettre. Ha még nem, a rendszerből egy gombnyomással tudsz baráti emlékeztetőt küldeni.</p>
            ${input.tenantName ? `<p><b>Bérlő:</b> ${input.tenantName}</p>` : ""}
            <p>${propertyLine}</p>
            <ul>
                <li><b>Megnevezés:</b> ${input.title}</li>
                <li><b>Összeg:</b> ${input.amount} ${input.currency}</li>
                <li><b>Esedékesség:</b> ${input.dueDate}</li>
            </ul>
            ${actionButtons}
        </div>
    `;

    return { to: input.ownerEmail, subject, html, text };
}

export function renderFriendlyArrearsReminderEmail(input: FriendlyArrearsReminderInput) {
    const nameLine = input.tenantName ? `Szia ${input.tenantName},` : "Szia,";
    const propertyLine = input.propertyName ? `Ingatlan: ${input.propertyName}` : "Ingatlan: -";
    const subject = "Baráti emlékeztető a nyitott díjról";
    const text = [
        nameLine,
        "Baráti emlékeztetőként írunk, mert az alábbi díj még nyitottként szerepel a rendszerben.",
        "Ha közben rendezted, kérünk jelezd a bérbeadódnak. Ha még nem, a részleteket a rendszerben is eléred.",
        propertyLine,
        `Megnevezés: ${input.title}`,
        `Összeg: ${input.amount} ${input.currency}`,
        `Lejárat: ${input.dueDate}`,
        `Részletek: ${SITE_URL}/tenant/charges`,
    ].join("\n");

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>${nameLine}</p>
            <p>Baráti emlékeztetőként írunk, mert az alábbi díj még nyitottként szerepel a rendszerben.</p>
            <p>Ha közben rendezted, kérünk jelezd a bérbeadódnak. Ha még nem, a részleteket a rendszerben is eléred.</p>
            <p>${propertyLine}</p>
            <ul>
                <li><b>Megnevezés:</b> ${input.title}</li>
                <li><b>Összeg:</b> ${input.amount} ${input.currency}</li>
                <li><b>Lejárat:</b> ${input.dueDate}</li>
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
        input.existingAccount ? "Bérlői hozzáférést kaptál egy meglévő fiókhoz." : "Létrehoztuk a bérlői fiókodat.",
        input.existingAccount
            ? "A belépéshez nyisd meg az alábbi linket, és válaszd a bérlői nézetet:"
            : "Az aktiváláshoz nyisd meg az alábbi meghívó linket, ezzel belépsz:",
        input.inviteLink,
        `Jelszó beállítása belépés után: ${SITE_URL}/account`,
    ].join("\n");

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>${nameLine}</p>
            <p>${input.existingAccount ? "Bérlői hozzáférést kaptál egy meglévő fiókhoz." : "Létrehoztuk a bérlői fiókodat."}</p>
            <p>
                ${input.existingAccount ? "A belépéshez nyisd meg ezt a linket, majd válaszd a bérlői nézetet:" : "Az aktiváláshoz nyisd meg ezt a meghívó linket, ezzel belépsz:"}
                <br />
                <a href="${input.inviteLink}">Meghívó link megnyitása</a>
            </p>
            <p>Jelszó beállítása belépés után: <a href="${SITE_URL}/account">${SITE_URL}/account</a></p>
        </div>
    `;

    return { to: input.tenantEmail, subject, html, text };
}

export function renderOwnerInviteEmail(input: OwnerInviteInput) {
    const subject = "Bérbeadói hozzáférés";
    const nameLine = input.ownerName ? `Szia ${input.ownerName},` : "Szia,";
    const text = [
        nameLine,
        input.existingAccount ? "Bérbeadói hozzáférést kaptál egy meglévő fiókhoz." : "Létrehoztuk a bérbeadói fiókodat.",
        input.existingAccount
            ? "A belépéshez nyisd meg az alábbi linket, és válaszd a bérbeadói nézetet:"
            : "Az aktiváláshoz nyisd meg az alábbi meghívó linket, ezzel belépsz:",
        input.inviteLink,
        `Jelszó beállítása belépés után: ${SITE_URL}/account`,
    ].join("\n");

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>${nameLine}</p>
            <p>${input.existingAccount ? "Bérbeadói hozzáférést kaptál egy meglévő fiókhoz." : "Létrehoztuk a bérbeadói fiókodat."}</p>
            <p>
                ${input.existingAccount ? "A belépéshez nyisd meg ezt a linket, majd válaszd a bérbeadói nézetet:" : "Az aktiváláshoz nyisd meg ezt a meghívó linket, ezzel belépsz:"}
                <br />
                <a href="${input.inviteLink}">Meghívó link megnyitása</a>
            </p>
            <p>Jelszó beállítása belépés után: <a href="${SITE_URL}/account">${SITE_URL}/account</a></p>
        </div>
    `;

    return { to: input.ownerEmail, subject, html, text };
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
        `Részletek: ${input.openUrl || input.reviewUrl || `${SITE_URL}/owner/importok`}`,
    ].filter(Boolean).join("\n");

    const actionButtons = renderActionButtons([
        input.publishUrl ? { label: "Jónak tűnik, mehet", href: input.publishUrl, primary: true } : null,
        input.chargeUrl ? { label: "Megnyitom a piszkozatot", href: input.chargeUrl } : null,
        input.reviewUrl ? { label: input.status === "FAILED" ? "Megnyitom az importot" : "Nem jó, szerkesztem", href: input.reviewUrl } : null,
        { label: "Importok megnyitása", href: input.openUrl || `${SITE_URL}/owner/importok` },
    ].filter(Boolean) as Array<{ label: string; href: string; primary?: boolean }>);

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
            ${actionButtons}
        </div>
    `;

    return { to: input.ownerEmail, subject, html, text };
}

export function renderOwnerLeadEmail(input: OwnerLeadInput) {
    const subject = "Új bérbeadói regisztrációs igény";
    const text = [
        "Új bérbeadói regisztrációs igény érkezett.",
        `Név: ${input.fullName}`,
        input.companyName ? `Cégnév: ${input.companyName}` : null,
        `E-mail: ${input.email}`,
        `Telefon: ${input.phone}`,
        `Számlázási cím: ${input.billingAddress}`,
    ].filter(Boolean).join("\n");

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>Új bérbeadói regisztrációs igény</h2>
            <ul>
                <li><b>Név:</b> ${input.fullName}</li>
                ${input.companyName ? `<li><b>Cégnév:</b> ${input.companyName}</li>` : ""}
                <li><b>E-mail:</b> ${input.email}</li>
                <li><b>Telefon:</b> ${input.phone}</li>
                <li><b>Számlázási cím:</b> ${input.billingAddress}</li>
            </ul>
        </div>
    `;

    return { to: input.ownerEmail, subject, html, text };
}

export function renderTenantDeletionRequestEmail(input: TenantDeletionRequestInput) {
    const ownerName = input.ownerName ? `Szia ${input.ownerName},` : "Szia,";
    const tenantLabel = input.tenantName ? `${input.tenantName} (${input.tenantEmail})` : input.tenantEmail;
    const subject = "Bérlői profil törlési kérelem";
    const text = [
        ownerName,
        "Egy bérlő profil törlési kérelmet küldött.",
        `Bérlő: ${tenantLabel}`,
        "Kérünk ellenőrizd, hogy minden nyitott ügy le van-e zárva, és utána egyeztess vele a törlésről.",
    ].join("\n");

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>${ownerName}</p>
            <p>Egy bérlő profil törlési kérelmet küldött.</p>
            <ul>
                <li><b>Bérlő:</b> ${tenantLabel}</li>
            </ul>
            <p>Kérünk ellenőrizd, hogy minden nyitott ügy le van-e zárva, és utána egyeztess vele a törlésről.</p>
        </div>
    `;

    return { to: input.ownerEmail, subject, html, text };
}

export function renderTenantExitRequestEmail(input: TenantExitRequestInput) {
    const ownerName = input.ownerName ? `Szia ${input.ownerName},` : "Szia,";
    const tenantLabel = input.tenantName ? `${input.tenantName} (${input.tenantEmail})` : input.tenantEmail;
    const subject = "Bérlői kilépési kérelem";
    const text = [
        ownerName,
        "Egy bérlő kérte, hogy kerüljön le az egyik ingatlanodról.",
        `Bérlő: ${tenantLabel}`,
        `Ingatlan: ${input.propertyName}`,
        input.propertyAddress ? `Cím: ${input.propertyAddress}` : null,
        `Jóváhagyás: ${input.openUrl}`,
    ].filter(Boolean).join("\n");

    const actionButtons = renderActionButtons([
        { label: "Kérelem megnyitása", href: input.openUrl, primary: true },
    ]);

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>${ownerName}</p>
            <p>Egy bérlő kérte, hogy kerüljön le az egyik ingatlanodról.</p>
            <ul>
                <li><b>Bérlő:</b> ${tenantLabel}</li>
                <li><b>Ingatlan:</b> ${input.propertyName}</li>
                ${input.propertyAddress ? `<li><b>Cím:</b> ${input.propertyAddress}</li>` : ""}
            </ul>
            <p>A jóváhagyást a Rentappban tudod elvégezni.</p>
            ${actionButtons}
        </div>
    `;

    return { to: input.ownerEmail, subject, html, text };
}

export function renderUnknownInboundInvoiceEmail(input: UnknownInboundInvoiceInput) {
    const greeting = input.ownerName ? `Szia ${input.ownerName},` : "Szia,";
    const subject = "Új számla érkezett ismeretlen feladótól";
    const text = [
        greeting,
        "Érkezett egy számla a közös bejövő címre olyan feladótól, amit a rendszer nem tudott közvetlenül hozzád kötni.",
        input.sourceEmailFrom ? `Feladó: ${input.sourceEmailFrom}` : null,
        input.fileName ? `Fájlnév: ${input.fileName}` : null,
        input.propertyName ? `Feltételezett ingatlan: ${input.propertyName}` : null,
        `Feldolgozás jóváhagyása: ${input.approveUrl}`,
        `Elutasítás: ${input.rejectUrl}`,
        `Részletek: ${input.reviewUrl}`,
    ].filter(Boolean).join("\n");

    const actionButtons = renderActionButtons([
        { label: "Igen, dolgozd fel", href: input.approveUrl, primary: true },
        { label: "Nem ismerős", href: input.rejectUrl },
        { label: "Megnyitom az importot", href: input.reviewUrl },
    ]);

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>${greeting}</p>
            <p>Érkezett egy számla a közös bejövő címre olyan feladótól, amit a rendszer nem tudott közvetlenül hozzád kötni.</p>
            <ul>
                ${input.sourceEmailFrom ? `<li><b>Feladó:</b> ${input.sourceEmailFrom}</li>` : ""}
                ${input.fileName ? `<li><b>Fájl:</b> ${input.fileName}</li>` : ""}
                ${input.propertyName ? `<li><b>Feltételezett ingatlan:</b> ${input.propertyName}</li>` : ""}
            </ul>
            <p>Ha ez valóban hozzád tartozik, indítsd el a feldolgozást. Ha nem ismerős, jelöld elutasítottnak.</p>
            ${actionButtons}
        </div>
    `;

    return { to: input.ownerEmail, subject, html, text };
}
