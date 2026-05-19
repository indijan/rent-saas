"use server";

import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderTenantInviteEmail } from "@/lib/email/templates";
import { isTenantOwnedByOwner } from "@/lib/tenantOwnership";
import { ensurePropertyPrimaryTenant, syncOwnerTenantMembership } from "@/lib/propertyTenants";

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

    const { data: propertyAssignments } = await admin
        .from("property_tenants")
        .select("property_id")
        .eq("owner_id", user.id)
        .eq("tenant_id", tenantId);

    for (const row of propertyAssignments ?? []) {
        const propertyId = row.property_id as string | null;
        if (!propertyId) continue;

        const { error: assignmentDeleteError } = await admin
            .from("property_tenants")
            .delete()
            .eq("property_id", propertyId)
            .eq("tenant_id", tenantId)
            .eq("owner_id", user.id);

        if (assignmentDeleteError) return { ok: false, error: assignmentDeleteError.message };

        await ensurePropertyPrimaryTenant(propertyId);
    }

    const { error: propertyFallbackError } = await admin
        .from("properties")
        .update({ tenant_id: null })
        .eq("tenant_id", tenantId)
        .eq("owner_id", user.id);
    if (propertyFallbackError) return { ok: false, error: propertyFallbackError.message };

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

    const { error: membershipError } = await admin
        .from("tenant_memberships")
        .delete()
        .eq("user_id", tenantId)
        .eq("owner_id", user.id);
    if (membershipError) return { ok: false, error: membershipError.message };

    await admin
        .from("tenant_exit_requests")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("owner_id", user.id);

    return { ok: true };
}

export async function approveTenantExitRequest(requestId: string) {
    const { user } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const { data: requestRow, error } = await admin
        .from("tenant_exit_requests")
        .select("id,tenant_id,property_id,owner_id,status")
        .eq("id", requestId)
        .eq("owner_id", user.id)
        .eq("status", "PENDING")
        .single();

    if (error || !requestRow) return { ok: false, error: "A kilépési kérelem nem található." };

    const { error: assignmentDeleteError } = await admin
        .from("property_tenants")
        .delete()
        .eq("property_id", requestRow.property_id)
        .eq("tenant_id", requestRow.tenant_id)
        .eq("owner_id", user.id);

    if (assignmentDeleteError) return { ok: false, error: assignmentDeleteError.message };

    await ensurePropertyPrimaryTenant(requestRow.property_id as string);
    await syncOwnerTenantMembership(user.id, requestRow.tenant_id as string);

    const { error: requestError } = await admin
        .from("tenant_exit_requests")
        .update({
            status: "APPROVED",
            reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("owner_id", user.id);

    if (requestError) return { ok: false, error: requestError.message };

    return { ok: true };
}

export async function rejectTenantExitRequest(requestId: string) {
    const { user } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const { error } = await admin
        .from("tenant_exit_requests")
        .update({
            status: "REJECTED",
            reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("owner_id", user.id)
        .eq("status", "PENDING");

    if (error) return { ok: false, error: error.message };
    return { ok: true };
}
