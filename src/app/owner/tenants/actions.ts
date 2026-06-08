"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderTenantExitApprovedEmail, renderTenantExitRejectedEmail, renderTenantInviteEmail } from "@/lib/email/templates";
import { isTenantOwnedByOwner } from "@/lib/tenantOwnership";
import { ensurePropertyPrimaryTenant, syncOwnerTenantMembership } from "@/lib/propertyTenants";

export async function createTenant(formData: FormData) {
    const { user } = await requireRole("OWNER");

    const full_name = String(formData.get("full_name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const propertyId = String(formData.get("property_id") || "").trim();

    if (!full_name || !email) {
        return { ok: false, error: "Név és email kötelező." };
    }

    const admin = createSupabaseAdminClient();
    if (propertyId) {
        const { data: property, error: propertyError } = await admin
            .from("properties")
            .select("id")
            .eq("id", propertyId)
            .eq("owner_id", user.id)
            .maybeSingle();

        if (propertyError || !property) {
            return { ok: false, error: "A kiválasztott ingatlan nem található." };
        }
    }

    async function assignTenantToProperty(tenantId: string) {
        if (!propertyId) return { ok: true as const };

        const { data: property, error: propertyStateError } = await admin
            .from("properties")
            .select("id,tenant_id")
            .eq("id", propertyId)
            .eq("owner_id", user.id)
            .maybeSingle();

        if (propertyStateError || !property) {
            return { ok: false as const, error: "A kiválasztott ingatlan nem található." };
        }

        const { error: assignmentError } = await admin
            .from("property_tenants")
            .upsert({
                owner_id: user.id,
                property_id: propertyId,
                tenant_id: tenantId,
            }, { onConflict: "property_id,tenant_id" });

        if (assignmentError) {
            return { ok: false as const, error: assignmentError.message };
        }

        if (!property.tenant_id) {
            const { error: chargeUpdateError } = await admin
                .from("charges")
                .update({ tenant_id: tenantId })
                .eq("property_id", propertyId)
                .eq("owner_id", user.id)
                .is("tenant_id", null);

            if (chargeUpdateError) {
                return { ok: false as const, error: chargeUpdateError.message };
            }
        }

        await ensurePropertyPrimaryTenant(propertyId);
        await syncOwnerTenantMembership(user.id, tenantId);
        return { ok: true as const };
    }

    const { data: existing, error: existingError } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email);

    if (existingError) return { ok: false, error: existingError.message };

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu";
    const redirectTo = siteUrl ? `${siteUrl}/auth/callback?next=/account` : undefined;
    const existingUserId = (existing ?? [])[0]?.id as string | undefined;

    if (existingUserId) {
        const { error: membershipError } = await admin
            .from("tenant_memberships")
            .upsert({ user_id: existingUserId, owner_id: user.id }, { onConflict: "user_id,owner_id" });
        if (membershipError) return { ok: false, error: membershipError.message };

        const assignmentResult = await assignTenantToProperty(existingUserId);
        if (!assignmentResult.ok) return assignmentResult;

        const emailPayload = renderTenantInviteEmail({
            tenantEmail: email,
            tenantName: full_name,
            inviteLink: `${siteUrl}/login`,
            existingAccount: true,
        });
        const emailRes = await sendEmail({
            ...emailPayload,
            log: {
                ownerId: user.id,
                tenantId: existingUserId,
                propertyId: propertyId || null,
                category: "TENANT_INVITE",
                templateKey: "tenant_invite",
                recipientRole: "TENANT",
                meta: {
                    tenantName: full_name,
                    existingAccount: true,
                },
            },
        });
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

        const assignmentResult = await assignTenantToProperty(userId);
        if (!assignmentResult.ok) return assignmentResult;
    }

    const emailPayload = renderTenantInviteEmail({
        tenantEmail: email,
        tenantName: full_name,
        inviteLink: data.properties.action_link,
    });
    const emailRes = await sendEmail({
        ...emailPayload,
        log: {
            ownerId: user.id,
            tenantId: userId ?? null,
            propertyId: propertyId || null,
            category: "TENANT_INVITE",
            templateKey: "tenant_invite",
            recipientRole: "TENANT",
            meta: {
                tenantName: full_name,
                existingAccount: false,
            },
        },
    });
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
        .select("id,tenant_id,property_id,owner_id,status,properties(name,address),profiles!tenant_exit_requests_tenant_id_fkey(email,full_name)")
        .eq("id", requestId)
        .eq("owner_id", user.id)
        .eq("status", "PENDING")
        .single();

    if (error || !requestRow) return { ok: false, error: "A kilépési kérelem nem található." };

    const tenant = Array.isArray(requestRow.profiles) ? requestRow.profiles[0] : requestRow.profiles;
    const property = Array.isArray(requestRow.properties) ? requestRow.properties[0] : requestRow.properties;

    const { data: assignmentRow, error: assignmentLookupError } = await admin
        .from("property_tenants")
        .select("property_id")
        .eq("property_id", requestRow.property_id)
        .eq("tenant_id", requestRow.tenant_id)
        .eq("owner_id", user.id)
        .maybeSingle();

    if (assignmentLookupError) return { ok: false, error: assignmentLookupError.message };
    if (!assignmentRow) return { ok: false, error: "A bérlő már nincs hozzárendelve ehhez az ingatlanhoz." };

    const { error: assignmentDeleteError } = await admin
        .from("property_tenants")
        .delete()
        .eq("property_id", requestRow.property_id)
        .eq("tenant_id", requestRow.tenant_id)
        .eq("owner_id", user.id);

    if (assignmentDeleteError) return { ok: false, error: assignmentDeleteError.message };

    const { error: chargeUpdateError } = await admin
        .from("charges")
        .update({ tenant_id: null })
        .eq("property_id", requestRow.property_id)
        .eq("tenant_id", requestRow.tenant_id)
        .eq("owner_id", user.id);

    if (chargeUpdateError) return { ok: false, error: chargeUpdateError.message };

    const { error: documentUpdateError } = await admin
        .from("documents")
        .update({ tenant_id: null })
        .eq("property_id", requestRow.property_id)
        .eq("tenant_id", requestRow.tenant_id)
        .eq("owner_id", user.id);

    if (documentUpdateError) return { ok: false, error: documentUpdateError.message };

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

    if (tenant?.email) {
        const payload = renderTenantExitApprovedEmail({
            tenantEmail: tenant.email,
            tenantName: tenant.full_name,
            ownerName: user.user_metadata?.full_name ?? null,
            propertyName: property?.name || "Ingatlan",
            propertyAddress: property?.address || null,
            openUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu"}/account`,
        });
        const emailResult = await sendEmail({
            ...payload,
            log: {
                ownerId: user.id,
                tenantId: requestRow.tenant_id as string,
                propertyId: requestRow.property_id as string,
                category: "TENANT_EXIT_APPROVED",
                templateKey: "tenant_exit_approved",
                recipientRole: "TENANT",
                meta: {
                    tenantName: tenant.full_name ?? null,
                    propertyName: property?.name || "Ingatlan",
                    propertyAddress: property?.address || null,
                },
            },
        });

        if (!emailResult.ok) {
            console.error("Tenant exit approval email failed", emailResult.error);
        }
    }

    revalidatePath("/owner/tenants");
    revalidatePath("/owner/properties");
    revalidatePath(`/owner/properties/${requestRow.property_id}`);
    revalidatePath("/account");

    return { ok: true };
}

export async function rejectTenantExitRequest(requestId: string) {
    const { user } = await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const { data: requestRow, error: requestLookupError } = await admin
        .from("tenant_exit_requests")
        .select("id,tenant_id,property_id,owner_id,status,properties(name,address),profiles!tenant_exit_requests_tenant_id_fkey(email,full_name)")
        .eq("id", requestId)
        .eq("owner_id", user.id)
        .eq("status", "PENDING")
        .single();

    if (requestLookupError || !requestRow) return { ok: false, error: "A kilépési kérelem nem található." };

    const tenant = Array.isArray(requestRow.profiles) ? requestRow.profiles[0] : requestRow.profiles;
    const property = Array.isArray(requestRow.properties) ? requestRow.properties[0] : requestRow.properties;

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

    if (tenant?.email) {
        const payload = renderTenantExitRejectedEmail({
            tenantEmail: tenant.email,
            tenantName: tenant.full_name,
            ownerName: user.user_metadata?.full_name ?? null,
            propertyName: property?.name || "Ingatlan",
            propertyAddress: property?.address || null,
            openUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu"}/account#kilepesi-kerelem-kuldes`,
        });
        const emailResult = await sendEmail({
            ...payload,
            log: {
                ownerId: user.id,
                tenantId: requestRow.tenant_id as string,
                propertyId: requestRow.property_id as string,
                category: "TENANT_EXIT_REJECTED",
                templateKey: "tenant_exit_rejected",
                recipientRole: "TENANT",
                meta: {
                    tenantName: tenant.full_name ?? null,
                    propertyName: property?.name || "Ingatlan",
                    propertyAddress: property?.address || null,
                },
            },
        });

        if (!emailResult.ok) {
            console.error("Tenant exit rejection email failed", emailResult.error);
        }
    }

    revalidatePath("/owner/tenants");
    revalidatePath("/account");

    return { ok: true };
}
