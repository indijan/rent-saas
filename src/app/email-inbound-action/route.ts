import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyInboundApprovalToken } from "@/lib/inboundApprovalTokens";
import { processStoredIngestion } from "@/lib/ingestionProcessing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu";

function redirectWithMessage(path: string, status: "success" | "error", message: string) {
    redirect(`${SITE_URL}${path}${path.includes("?") ? "&" : "?"}status=${status}&message=${encodeURIComponent(message)}`);
}

function renderConfirmHtml(input: {
    token: string;
    title: string;
    description: string;
    button: string;
    cancelHref: string;
    fileName?: string | null;
    sender?: string | null;
}) {
    return `<!doctype html>
<html lang="hu">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${input.title} · Rentapp</title>
    <style>
      body { margin:0; font-family:Arial,sans-serif; background:linear-gradient(180deg,#f3f7ff 0%,#edf3ff 100%); color:#172033; }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
      .card { width:min(560px,100%); background:#fff; border-radius:28px; box-shadow:0 22px 60px rgba(58,92,164,0.16); padding:32px; }
      .eyebrow { font-size:13px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#64748b; }
      h1 { margin:10px 0 12px; font-size:32px; line-height:1.1; }
      p { margin:0 0 16px; color:#53627c; line-height:1.6; }
      .summary { margin:24px 0; border:1px solid rgba(23,32,51,.08); border-radius:20px; padding:18px 20px; background:#f8fbff; }
      .actions { display:flex; gap:12px; flex-wrap:wrap; margin-top:24px; }
      .btn { appearance:none; border:0; border-radius:999px; padding:14px 22px; font-weight:700; font-size:15px; text-decoration:none; cursor:pointer; }
      .btn-primary { background:#2563eb; color:#fff; }
      .btn-secondary { background:#fff; color:#172033; border:1px solid rgba(23,32,51,.12); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="eyebrow">Rentapp számla-jóváhagyás</div>
        <h1>${input.title}</h1>
        <p>${input.description}</p>
        <div class="summary">
          ${input.fileName ? `<div><b>Fájl:</b> ${input.fileName}</div>` : ""}
          ${input.sender ? `<div><b>Feladó:</b> ${input.sender}</div>` : ""}
        </div>
        <div class="actions">
          <form method="POST" action="${SITE_URL}/email-inbound-action">
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

export async function GET(request: Request) {
    const url = new URL(request.url);
    const token = String(url.searchParams.get("token") || "").trim();
    const payload = verifyInboundApprovalToken(token);
    if (!payload) {
        redirectWithMessage("/login", "error", "Az e-mailes jóváhagyási link érvénytelen vagy lejárt.");
        return;
    }

    const admin = createSupabaseAdminClient();
    const { data: ingestion } = await admin
        .from("document_ingestions")
        .select("id,source_attachment_name,source_email_from")
        .eq("id", payload.ingestionId)
        .limit(1)
        .maybeSingle();

    return new Response(renderConfirmHtml({
        token,
        title: payload.action === "approve" ? "Számla feldolgozásának jóváhagyása" : "Számla elutasítása",
        description: payload.action === "approve"
            ? "Ezzel elindítod a számla feldolgozását a Rentappban."
            : "Ezzel jelzed, hogy a számla nem hozzád tartozik.",
        button: payload.action === "approve" ? "Igen, dolgozd fel" : "Nem ismerős",
        cancelHref: "/owner/importok",
        fileName: ingestion?.source_attachment_name,
        sender: ingestion?.source_email_from,
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
    const payload = verifyInboundApprovalToken(token);
    if (!payload) {
        redirectWithMessage("/login", "error", "Az e-mailes jóváhagyási link érvénytelen vagy lejárt.");
        return;
    }

    const admin = createSupabaseAdminClient();

    if (payload.action === "reject") {
        await admin
            .from("document_ingestions")
            .update({
                status: "FAILED",
                error_message: "A számlát a bérbeadó elutasította, mert nem ismerte fel a feladót.",
                processed_at: new Date().toISOString(),
            })
            .eq("id", payload.ingestionId);

        redirectWithMessage("/owner/importok", "success", "A számla elutasítva lett.");
    }

    const result = await processStoredIngestion(payload.ingestionId);
    if (!result.ok) {
        redirectWithMessage("/owner/importok", "error", result.error ?? "A feldolgozás nem sikerült.");
        return;
    }

    redirectWithMessage("/owner/importok", "success", result.needsReview ? "A számla ellenőrzésre került." : "A számla feldolgozása elindult.");
}
