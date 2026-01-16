import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderImportInvoiceStatusEmail, renderNewChargeEmail } from "@/lib/email/templates";
import { extractInvoiceFromBuffer } from "@/app/owner/properties/[id]/charges/actions";

function safeFileName(value: string) {
    return value.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function POST(request: Request) {
    const secret = process.env.IMPORT_SECRET;
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
    if (!secret || token !== secret) {
        return new Response("Unauthorized", { status: 401 });
    }

    const propertyId = process.env.IMPORT_PROPERTY_ID;
    const ownerEmail = process.env.IMPORT_OWNER_EMAIL;
    if (!propertyId || !ownerEmail) {
        return new Response("Missing import config", { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
        return new Response("Missing file", { status: 400 });
    }
    if (file.type !== "application/pdf") {
        return new Response("Only PDF supported", { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractInvoiceFromBuffer(buffer);
    if (!extraction.ok || !extraction.data) {
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail,
            status: "FAILED",
            fileName: file.name,
            error: extraction.error || "AI feldolgozás sikertelen.",
        }));
        return new Response(JSON.stringify({ ok: false, error: extraction.error }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const data = extraction.data;
    const amount = Number.isFinite(data.amount ?? NaN) ? Number(data.amount) : null;
    const dueDate = data.due_date ?? null;
    const provider = data.name ?? null;
    if (!amount || !dueDate || !provider) {
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail,
            status: "FAILED",
            fileName: file.name,
            provider,
            amount: amount ?? null,
            currency: data.currency ?? "HUF",
            dueDate,
            error: "Hiányzó kötelező mező (összeg, határidő, szolgáltató).",
        }));
        return new Response(JSON.stringify({ ok: false, error: "Missing required fields" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const admin = createSupabaseAdminClient();
    const { data: property, error: propErr } = await admin
        .from("properties")
        .select("id,name,owner_id,tenant_id")
        .eq("id", propertyId)
        .single();
    if (propErr || !property) {
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail,
            status: "FAILED",
            fileName: file.name,
            provider,
            amount,
            currency: data.currency ?? "HUF",
            dueDate,
            error: "Property nem található.",
        }));
        return new Response("Property not found", { status: 400 });
    }

    const title = `Számla – ${provider} – ${dueDate}`;
    const currency = data.currency ?? "HUF";
    const { data: createdCharge, error: chargeErr } = await admin
        .from("charges")
        .insert({
            property_id: propertyId,
            owner_id: property.owner_id,
            tenant_id: property.tenant_id,
            type: data.type ?? "UTILITY",
            title,
            amount,
            currency,
            due_date: dueDate,
            status: "UNPAID",
        })
        .select("id")
        .single();

    if (chargeErr || !createdCharge?.id) {
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail,
            status: "FAILED",
            fileName: file.name,
            provider,
            amount,
            currency,
            dueDate,
            error: chargeErr?.message || "Charge insert hiba.",
        }));
        return new Response("Charge insert error", { status: 500 });
    }

    const safeName = safeFileName(file.name || "invoice.pdf") || "invoice.pdf";
    const path = `${property.owner_id}/${createdCharge.id}/${Date.now()}-${safeName}`;
    const { error: uploadErr } = await admin.storage
        .from("documents")
        .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadErr) {
        await admin.from("charges").delete().eq("id", createdCharge.id);
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail,
            status: "FAILED",
            fileName: file.name,
            provider,
            amount,
            currency,
            dueDate,
            error: uploadErr.message,
        }));
        return new Response("Upload failed", { status: 500 });
    }

    const { error: docErr } = await admin.from("documents").insert({
        owner_id: property.owner_id,
        tenant_id: property.tenant_id,
        property_id: propertyId,
        charge_id: createdCharge.id,
        bucket_path: path,
        type: "INVOICE",
    });
    if (docErr) {
        await admin.storage.from("documents").remove([path]);
        await admin.from("charges").delete().eq("id", createdCharge.id);
        await sendEmail(renderImportInvoiceStatusEmail({
            ownerEmail,
            status: "FAILED",
            fileName: file.name,
            provider,
            amount,
            currency,
            dueDate,
            error: docErr.message,
        }));
        return new Response("Document insert failed", { status: 500 });
    }

    await sendEmail(renderImportInvoiceStatusEmail({
        ownerEmail,
        status: "SUCCESS",
        fileName: file.name,
        provider,
        amount,
        currency,
        dueDate,
        propertyName: property.name ?? null,
    }));

    if (property.tenant_id) {
        const { data: tenantProfile } = await admin
            .from("profiles")
            .select("email")
            .eq("id", property.tenant_id)
            .single();

        if (tenantProfile?.email) {
            const emailPayload = renderNewChargeEmail({
                tenantEmail: tenantProfile.email,
                title,
                amount,
                currency,
                dueDate,
                propertyName: property.name ?? null,
                count: 1,
            });
            await sendEmail(emailPayload);
        }
    }

    return new Response(JSON.stringify({ ok: true, chargeId: createdCharge.id }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}
