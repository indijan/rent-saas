"use server";

import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderTenantInviteEmail } from "@/lib/email/templates";
import { isTenantOwnedByOwner } from "@/lib/tenantOwnership";

export async function createTenant(formData: FormData) {
    const { user } = await requireRole("OWNER");

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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const redirectTo = siteUrl ? `${siteUrl}/auth/callback?next=/account` : undefined;
    const existingUserId = (existing ?? [])[0]?.id as string | undefined;

    if (existingUserId) {
        const { error: membershipError } = await admin
            .from("tenant_memberships")
            .upsert({ user_id: existingUserId, owner_id: user.id }, { onConflict: "user_id,owner_id" });
        if (membershipError) return { ok: false, error: membershipError.message };

        const emailPayload = renderTenantInviteEmail({
            tenantEmail: email,
            tenantName: full_name,
            inviteLink: `${siteUrl}/login`,
            existingAccount: true,
        });
        const emailRes = await sendEmail(emailPayload);
        if (!emailRes.ok) {
            return { ok: false, error: emailRes.error ?? "A bérlő értesítése nem sikerült." };
        }
        return { ok: true };
    }

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

        const { error: membershipError } = await admin
            .from("tenant_memberships")
            .upsert({ user_id: userId, owner_id: user.id }, { onConflict: "user_id,owner_id" });
        if (membershipError) return { ok: false, error: membershipError.message };
    }

    const emailPayload = renderTenantInviteEmail({
        tenantEmail: email,
        tenantName: full_name,
        inviteLink: data.properties.action_link,
    });
    const emailRes = await sendEmail(emailPayload);
    if (!emailRes.ok) {
        return { ok: false, error: emailRes.error ?? "A bérlő értesítése nem sikerült." };
    }

    return { ok: true };
}

export async function deleteTenant(tenantId: string) {
    const { user } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const isOwned = await isTenantOwnedByOwner(user.id, tenantId);
    if (!isOwned) return { ok: false, error: "Ezt a bérlőt nem kezelheted." };

    const { error: documentsError } = await admin
        .from("documents")
        .update({ tenant_id: null })
        .eq("tenant_id", tenantId)
        .eq("owner_id", user.id);
    if (documentsError) return { ok: false, error: documentsError.message };

    const { error: chargesError } = await admin
        .from("charges")
        .update({ tenant_id: null })
        .eq("tenant_id", tenantId)
        .eq("owner_id", user.id);
    if (chargesError) return { ok: false, error: chargesError.message };

    const { error: propertyError } = await admin
        .from("properties")
        .update({ tenant_id: null })
        .eq("tenant_id", tenantId)
        .eq("owner_id", user.id);
    if (propertyError) return { ok: false, error: propertyError.message };

    const { error: membershipError } = await admin
        .from("tenant_memberships")
        .delete()
        .eq("user_id", tenantId)
        .eq("owner_id", user.id);
    if (membershipError) return { ok: false, error: membershipError.message };

    return { ok: true };
}
