import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyEmailActionToken } from "@/lib/emailActionTokens";
import { renderFriendlyArrearsReminderEmail, renderNewChargeEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu";

type ActionName = "charge_mark_paid" | "charge_send_reminder" | "charge_publish";

type ChargeWithProperty = {
    id: string;
    owner_id: string;
    tenant_id: string | null;
    property_id: string;
    status: string;
    title: string;
    amount: number | string;
    currency: string | null;
    due_date: string;
    properties?: { name: string | null }[] | { name: string | null } | null;
};

function redirectWithMessage(path: string, status: "success" | "error", message: string) {
    redirect(`${SITE_URL}${path}${path.includes("?") ? "&" : "?"}status=${status}&message=${encodeURIComponent(message)}`);
}

function getChargeProperty(charge: ChargeWithProperty) {
    return Array.isArray(charge.properties) ? charge.properties[0] : charge.properties;
}

function getActionMeta(action: ActionName) {
    switch (action) {
        case "charge_mark_paid":
            return {
                title: "Fizetettre állítás",
                description: "Ezzel a díjat fizetettként jelölöd.",
                button: "Igen, fizetett",
                cancelHref: "/owner/todo",
            };
        case "charge_send_reminder":
            return {
                title: "Baráti emlékeztető küldése",
                description: "Ezzel elküldesz egy udvarias emlékeztetőt a bérlőnek.",
                button: "Igen, küldöm",
                cancelHref: "/owner/todo",
            };
        case "charge_publish":
            return {
                title: "Piszkozat publikálása",
                description: "Ezzel a piszkozat díjból aktív, kiküldhető tétel lesz.",
                button: "Jónak tűnik, mehet",
                cancelHref: "/owner/importok",
            };
    }
}

function renderConfirmHtml(input: {
    token: string;
    action: ActionName;
    title: string;
    description: string;
    button: string;
    cancelHref: string;
    charge: ChargeWithProperty;
}) {
    const property = getChargeProperty(input.charge);
    const amount = Number(input.charge.amount);
    const amountLabel = Number.isFinite(amount) ? `${amount.toLocaleString("hu-HU")} ${input.charge.currency || "HUF"}` : String(input.charge.amount);

    return `<!doctype html>
<html lang="hu">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title} · Rentapp</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: linear-gradient(180deg, #f3f7ff 0%, #edf3ff 100%);
        color: #172033;
      }
      .wrap {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        width: min(560px, 100%);
        background: #ffffff;
        border-radius: 28px;
        box-shadow: 0 22px 60px rgba(58, 92, 164, 0.16);
        padding: 32px;
      }
      .eyebrow {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #64748b;
      }
      h1 {
        margin: 10px 0 12px;
        font-size: 32px;
        line-height: 1.1;
      }
      p {
        margin: 0 0 16px;
        color: #53627c;
        line-height: 1.6;
      }
      .summary {
        margin: 24px 0;
        border: 1px solid rgba(23, 32, 51, 0.08);
        border-radius: 20px;
        padding: 18px 20px;
        background: #f8fbff;
      }
      .summary strong {
        display: block;
        font-size: 20px;
        margin-bottom: 8px;
      }
      .summary ul {
        margin: 0;
        padding-left: 18px;
        color: #53627c;
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 24px;
      }
      .btn {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 14px 22px;
        font-weight: 700;
        font-size: 15px;
        text-decoration: none;
        cursor: pointer;
      }
      .btn-primary {
        background: #2563eb;
        color: #ffffff;
      }
      .btn-secondary {
        background: #ffffff;
        color: #172033;
        border: 1px solid rgba(23, 32, 51, 0.12);
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="eyebrow">Rentapp e-mailes művelet</div>
        <h1>${input.title}</h1>
        <p>${input.description}</p>
        <div class="summary">
          <strong>${input.charge.title}</strong>
          <ul>
            ${property?.name ? `<li>Ingatlan: ${property.name}</li>` : ""}
            <li>Összeg: ${amountLabel}</li>
            <li>Határidő: ${input.charge.due_date}</li>
            <li>Jelenlegi státusz: ${input.charge.status}</li>
          </ul>
        </div>
        <div class="actions">
          <form method="POST" action="${SITE_URL}/email-action">
            <input type="hidden" name="token" value="${input.token}" />
            <button class="btn btn-primary" type="submit">${input.button}</button>
          </form>
          <a class="btn btn-secondary" href="${SITE_URL}${input.cancelHref}">Megnyitom az appban</a>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

async function loadCharge(chargeId: string) {
    const admin = createSupabaseAdminClient();
    const { data: charge, error } = await admin
        .from("charges")
        .select("id,owner_id,tenant_id,property_id,status,title,amount,currency,due_date,properties(name)")
        .eq("id", chargeId)
        .limit(1)
        .maybeSingle();

    return { admin, charge: charge as ChargeWithProperty | null, error };
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const token = String(url.searchParams.get("token") || "").trim();
    const payload = verifyEmailActionToken(token);

    if (!payload) {
        redirectWithMessage("/login", "error", "Az e-mailes műveleti link érvénytelen vagy lejárt.");
        return;
    }

    const { charge, error } = await loadCharge(payload.chargeId);
    if (error || !charge) {
        redirectWithMessage("/login", "error", "A díj nem található.");
        return;
    }

    const meta = getActionMeta(payload.action);

    return new Response(renderConfirmHtml({
        token,
        action: payload.action,
        title: meta.title,
        description: meta.description,
        button: meta.button,
        cancelHref: meta.cancelHref,
        charge,
    }), {
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
        },
    });
}

export async function POST(request: Request) {
    const formData = await request.formData();
    const token = String(formData.get("token") || "").trim();
    const payload = verifyEmailActionToken(token);

    if (!payload) {
        redirectWithMessage("/login", "error", "Az e-mailes műveleti link érvénytelen vagy lejárt.");
        return;
    }

    const { admin, charge, error } = await loadCharge(payload.chargeId);
    if (error || !charge) {
        redirectWithMessage("/login", "error", "A díj nem található.");
        return;
    }

    if (payload.action === "charge_mark_paid") {
        if (charge.status === "UNPAID") {
            await admin
                .from("charges")
                .update({ status: "PAID", paid_at: new Date().toISOString() })
                .eq("id", charge.id);
        }
        redirectWithMessage("/owner/todo", "success", "A díj fizetettre lett állítva.");
    }

    if (payload.action === "charge_send_reminder") {
        if (!charge.tenant_id) {
            redirectWithMessage("/owner/todo", "error", "Ehhez a díjhoz nincs bérlő hozzárendelve.");
            return;
        }

        const { data: tenantProfile } = await admin
            .from("profiles")
            .select("email,full_name")
            .eq("id", charge.tenant_id)
            .limit(1)
            .maybeSingle();

        if (!tenantProfile?.email) {
            redirectWithMessage("/owner/todo", "error", "A bérlő e-mail-címe nem érhető el.");
            return;
        }

        const property = getChargeProperty(charge);
        const emailResult = await sendEmail(renderFriendlyArrearsReminderEmail({
            tenantEmail: tenantProfile.email,
            tenantName: tenantProfile.full_name ?? null,
            title: charge.title,
            amount: Number(charge.amount),
            currency: String(charge.currency || "HUF"),
            dueDate: String(charge.due_date),
            propertyName: property?.name ?? null,
        }));

        if (!emailResult.ok) {
            redirectWithMessage("/owner/todo", "error", emailResult.error ?? "Az emlékeztető nem küldhető ki.");
            return;
        }

        await admin
            .from("charges")
            .update({ manual_reminder_sent_at: new Date().toISOString() })
            .eq("id", charge.id);

        redirectWithMessage("/owner/todo", "success", "A baráti emlékeztető elküldve.");
    }

    if (payload.action === "charge_publish") {
        if (charge.status === "IMPORT_DRAFT") {
            await admin
                .from("charges")
                .update({ status: "UNPAID" })
                .eq("id", charge.id);

            if (charge.tenant_id) {
                const { data: tenantProfile } = await admin
                    .from("profiles")
                    .select("email")
                    .eq("id", charge.tenant_id)
                    .limit(1)
                    .maybeSingle();

                if (tenantProfile?.email) {
                    const property = getChargeProperty(charge);
                    await sendEmail(renderNewChargeEmail({
                        tenantEmail: tenantProfile.email,
                        title: charge.title,
                        amount: Number(charge.amount),
                        currency: String(charge.currency || "HUF"),
                        dueDate: String(charge.due_date),
                        propertyName: property?.name ?? null,
                        count: 1,
                    }));
                }
            }
        }

        redirectWithMessage("/owner/importok", "success", "A draft díj publikálva lett.");
    }

    redirectWithMessage("/login", "error", "Ismeretlen e-mailes művelet.");
}
