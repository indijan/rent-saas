"use server";

import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderTenantInviteEmail } from "@/lib/email/templates";

export async function createTenant(formData: FormData) {
    await requireRole("OWNER");

    const full_name = String(formData.get("full_name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();

    if (!full_name || !email) {
        return { ok: false, error: "Név és email kötelező." };
    }

    const admin = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email);

    if (existingError) return { ok: false, error: existingError.message };
    if ((existing ?? []).length > 0) {
        return { ok: false, error: "Ezzel az emaillel már létezik felhasználó." };
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const redirectTo = siteUrl ? `${siteUrl}/auth/callback?next=/account` : undefined;
    const { data, error } = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
            redirectTo,
        },
    });

    if (error || !data?.properties?.action_link) {
        return { ok: false, error: error?.message || "Meghívó link hiba." };
    }

    const userId = data.user?.id;
    if (userId) {
        const { error: profileError } = await admin
            .from("profiles")
            .upsert({
                id: userId,
                email,
                full_name,
                role: "TENANT",
            });
        if (profileError) return { ok: false, error: profileError.message };
    }

    const emailPayload = renderTenantInviteEmail({
        tenantEmail: email,
        tenantName: full_name,
        inviteLink: data.properties.action_link,
    });
    const emailRes = await sendEmail(emailPayload);
    if (!emailRes.ok) return { ok: false, error: emailRes.error };

    return { ok: true };
}

export async function deleteTenant(tenantId: string) {
    await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const { error: chargesError } = await admin
        .from("charges")
        .update({ tenant_id: null })
        .eq("tenant_id", tenantId);
    if (chargesError) return { ok: false, error: chargesError.message };

    const { error: propertyError } = await admin
        .from("properties")
        .update({ tenant_id: null })
        .eq("tenant_id", tenantId);
    if (propertyError) return { ok: false, error: propertyError.message };

    const { error: profileError } = await admin
        .from("profiles")
        .delete()
        .eq("id", tenantId);
    if (profileError) return { ok: false, error: profileError.message };

    const { error: authError } = await admin.auth.admin.deleteUser(tenantId);
    if (authError) return { ok: false, error: authError.message };

    return { ok: true };
}
