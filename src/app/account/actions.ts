"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderTenantExitRequestEmail } from "@/lib/email/templates";
import { removeDocumentObjects } from "@/lib/documentStorage";
import { listTenantProperties } from "@/lib/propertyTenants";

type RoleScope = "ACCOUNT" | "TENANT_ROLE" | "OWNER_ROLE";
type ProfileRole = "OWNER" | "TENANT" | "ADMIN";

function pickRemainingRole(roles: ProfileRole[]) {
    if (roles.includes("OWNER")) return "OWNER" as const;
    if (roles.includes("TENANT")) return "TENANT" as const;
    if (roles.includes("ADMIN")) return "ADMIN" as const;
    return null;
}

async function removeTenantRoleData(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
    await admin.from("tenant_exit_requests").delete().eq("tenant_id", userId);
    await admin.from("property_tenants").delete().eq("tenant_id", userId);
    await admin.from("tenant_memberships").delete().eq("user_id", userId);
    await admin.from("charges").update({ tenant_id: null }).eq("tenant_id", userId);
    await admin.from("documents").update({ tenant_id: null }).eq("tenant_id", userId);
    await admin.from("properties").update({ tenant_id: null }).eq("tenant_id", userId);
}

async function removeOwnerRoleData(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
    const paths = new Set<string>();

    const [{ data: ownerDocuments }, { data: ownerIngestions }] = await Promise.all([
        admin.from("documents").select("bucket_path").eq("owner_id", userId),
        admin.from("document_ingestions").select("storage_key").eq("owner_id", userId),
    ]);

    (ownerDocuments ?? []).forEach((row) => {
        const path = row.bucket_path as string | null;
        if (path) paths.add(path);
    });
    (ownerIngestions ?? []).forEach((row) => {
        const path = row.storage_key as string | null;
        if (path) paths.add(path);
    });

    if (paths.size > 0) {
        await removeDocumentObjects(Array.from(paths));
    }

    await admin.from("property_import_aliases").delete().eq("owner_id", userId);
    await admin.from("supplier_profiles").delete().eq("owner_id", userId);
    await admin.from("extraction_reviews").delete().eq("reviewed_by", userId);
    await admin.from("document_fingerprints").delete().eq("owner_id", userId);
    await admin.from("tenant_exit_requests").delete().eq("owner_id", userId);
    await admin.from("property_tenants").delete().eq("owner_id", userId);
    await admin.from("documents").delete().eq("owner_id", userId);
    await admin.from("charges").delete().eq("owner_id", userId);
    await admin.from("document_ingestions").delete().eq("owner_id", userId);
    await admin.from("inbound_mailboxes").delete().eq("owner_id", userId);
    await admin.from("properties").delete().eq("owner_id", userId);
    await admin.from("tenant_memberships").delete().eq("owner_id", userId);
    await admin.from("owner_memberships").delete().eq("user_id", userId);
}

export async function logout() {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
}

export async function updateProfile(formData: FormData) {
    const { supabase, user } = await requireUser();
    const full_name = String(formData.get("full_name") || "").trim();

    if (!full_name) {
        redirect("/account?status=error&message=A+n%C3%A9v+megad%C3%A1sa+k%C3%B6telez%C5%91.");
    }

    const { error } = await supabase
        .from("profiles")
        .update({ full_name })
        .eq("id", user.id);

    if (error) {
        redirect(`/account?status=error&message=${encodeURIComponent(error.message)}`);
    }
    redirect("/account?status=success&message=N%C3%A9v+elmentve.");
}

export async function updatePassword(formData: FormData) {
    const supabase = await createSupabaseServerClient();
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("password_confirm") || "");

    if (!password || password.length < 8) {
        redirect("/account?status=error&message=A+jelsz%C3%B3nak+legal%C3%A1bb+8+karakter+hossz%C3%BAnak+kell+lennie.");
    }
    if (password !== confirm) {
        redirect("/account?status=error&message=A+jelszavak+nem+egyeznek.");
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
        redirect(`/account?status=error&message=${encodeURIComponent(error.message)}`);
    }
    redirect("/account?status=success&message=Jelsz%C3%B3+elmentve.");
}

export async function deleteProfile(formData: FormData) {
    const { supabase, user, profile } = await requireUser();
    const confirmation = String(formData.get("confirmation") || "").trim();
    const scope = (String(formData.get("scope") || "ACCOUNT").trim() || "ACCOUNT") as RoleScope;

    if (confirmation !== "DELETE") {
        redirect("/account?status=error&message=A+t%C3%B6rl%C3%A9shez+pontosan+a+DELETE+sz%C3%B3t+kell+megadnod.");
    }

    const admin = createSupabaseAdminClient();
    const availableRoles = Array.from(new Set(((profile.available_roles ?? [profile.role]) as ProfileRole[])));
    const hasOwnerRole = availableRoles.includes("OWNER");
    const hasTenantRole = availableRoles.includes("TENANT");
    const mixedRoleAccount = hasOwnerRole && hasTenantRole;
    const tenantOnly = profile.role === "TENANT" && (profile.available_roles?.length ?? 0) === 1;
    const activeTenantProperties = hasTenantRole ? await listTenantProperties(user.id) : [];

    if (scope === "TENANT_ROLE" && mixedRoleAccount && hasTenantRole) {
        if (activeTenantProperties.length > 0) {
            redirect("/account?status=error&message=A+b%C3%A9rl%C5%91i+szerepk%C3%B6r+t%C3%B6rl%C3%A9se+el%C5%91tt+minden+ingatlanr%C3%B3l+le+kell+ker%C3%BCln%C3%B6d.");
        }

        await removeTenantRoleData(admin, user.id);

        const nextRole = pickRemainingRole(availableRoles.filter((role) => role !== "TENANT"));
        if (nextRole) {
            await admin.from("profiles").update({ role: nextRole }).eq("id", user.id);
        }

        redirect("/valassz-nezetet?status=success&message=A+b%C3%A9rl%C5%91i+profil+t%C3%B6r%C3%B6lve.");
    }

    if (scope === "OWNER_ROLE" && mixedRoleAccount && hasOwnerRole) {
        await removeOwnerRoleData(admin, user.id);

        const nextRole = pickRemainingRole(availableRoles.filter((role) => role !== "OWNER"));
        if (nextRole) {
            await admin.from("profiles").update({ role: nextRole }).eq("id", user.id);
        }

        redirect("/valassz-nezetet?status=success&message=A+b%C3%A9rbead%C3%B3i+profil+t%C3%B6r%C3%B6lve.");
    }

    if (tenantOnly) {
        if (activeTenantProperties.length > 0) {
            redirect("/account?status=error&message=A+v%C3%A9gleges+t%C3%B6rl%C3%A9s+el%C5%91tt+minden+ingatlanr%C3%B3l+le+kell+ker%C3%BCln%C3%B6d.+K%C3%BCldj+kil%C3%A9p%C3%A9si+k%C3%A9relmet.");
        }

        await removeTenantRoleData(admin, user.id);
        await admin.from("profiles").delete().eq("id", user.id);
        await admin.auth.admin.deleteUser(user.id);

        await supabase.auth.signOut();
        redirect("/login?status=success&message=A+b%C3%A9rl%C5%91i+fi%C3%B3k+t%C3%B6r%C3%B6lve.+A+dokumentumok+megmaradtak+a+b%C3%A9rbead%C3%B3n%C3%A1l.");
    }

    await removeOwnerRoleData(admin, user.id);
    await removeTenantRoleData(admin, user.id);
    await admin.from("profiles").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id);

    await supabase.auth.signOut();
    redirect("/login?status=success&message=A+fi%C3%B3k+%C3%A9s+a+kapcsol%C3%B3d%C3%B3+dokumentumok+t%C3%B6r%C3%B6lve.");
}

export async function requestTenantProfileDeletion(formData: FormData) {
    const { user, profile } = await requireUser();
    const admin = createSupabaseAdminClient();
    const activeProperties = await listTenantProperties(user.id);
    const selectedPropertyId = String(formData.get("property_id") || "").trim();

    if (activeProperties.length === 0) {
        redirect("/account?status=success&message=Nincs+akt%C3%ADv+ingatlan-hozz%C3%A1rendel%C3%A9sed.+Most+m%C3%A1r+v%C3%A9gleg+t%C3%B6r%C3%B6lheted+a+profilodat.");
    }

    const targetProperties = selectedPropertyId && selectedPropertyId !== "ALL"
        ? activeProperties.filter((property) => property.id === selectedPropertyId)
        : activeProperties;

    if (targetProperties.length === 0) {
        redirect("/account?status=error&message=A+kiv%C3%A1lasztott+ingatlan+nem+tal%C3%A1lhat%C3%B3+a+b%C3%A9rl%C5%91i+hozz%C3%A1rendel%C3%A9seid+k%C3%B6z%C3%B6tt.");
    }

    let created = 0;
    let existing = 0;

    for (const property of targetProperties) {
        const { data: currentRequest } = await admin
            .from("tenant_exit_requests")
            .select("id,status")
            .eq("tenant_id", user.id)
            .eq("property_id", property.id)
            .eq("status", "PENDING")
            .maybeSingle();

        if (currentRequest) {
            existing += 1;
            continue;
        }

        const { error: requestError } = await admin
            .from("tenant_exit_requests")
            .insert({
                tenant_id: user.id,
                owner_id: property.owner_id,
                property_id: property.id,
                status: "PENDING",
            });

        if (requestError) {
            redirect(`/account?status=error&message=${encodeURIComponent(requestError.message)}`);
        }

        if (property.owner_email) {
            await sendEmail(renderTenantExitRequestEmail({
                ownerEmail: property.owner_email,
                ownerName: property.owner_name,
                tenantName: profile.full_name ?? null,
                tenantEmail: profile.email,
                propertyName: property.name,
                propertyAddress: property.address,
                openUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://rentapp.hu"}/owner/tenants`,
            }));
        }

        created += 1;
    }

    if (created === 0 && existing > 0) {
        redirect("/account?status=success&message=M%C3%A1r+van+folyamatban+l%C3%A9v%C5%91+kil%C3%A9p%C3%A9si+k%C3%A9relem.+V%C3%A1rd+meg+a+b%C3%A9rbead%C3%B3+j%C3%B3v%C3%A1hagy%C3%A1s%C3%A1t.");
    }

    redirect(`/account?status=success&message=${encodeURIComponent(
        targetProperties.length > 1
            ? "A kilépési kérelmek elküldve a kiválasztott ingatlanok bérbeadóinak."
            : "A kilépési kérelem elküldve a kiválasztott ingatlan bérbeadójának."
    )}`);
}

export async function sendAccountContactMessage(formData: FormData) {
    const { profile } = await requireUser();
    const topic = String(formData.get("topic") || "").trim() || "Kapcsolat";
    const message = String(formData.get("message") || "").trim();

    if (message.length < 10) {
        redirect("/account?status=error&message=Az+%C3%BCzenet+legyen+legal%C3%A1bb+10+karakter+hossz%C3%BA.#kapcsolat");
    }

    const roleLabel = profile.role === "OWNER" ? "Tulajdonos" : profile.role === "TENANT" ? "Bérlő" : "Admin";
    const availableRoleLabel = (profile.available_roles ?? [])
        .map((role) => role === "OWNER" ? "Tulajdonos" : role === "TENANT" ? "Bérlő" : "Admin")
        .join(", ");

    const text = [
        "Új kapcsolatfelvételi üzenet érkezett a bejelentkezett account oldalról.",
        `Név: ${profile.full_name || "-"}`,
        `E-mail: ${profile.email}`,
        `Aktív szerepkör: ${roleLabel}`,
        availableRoleLabel ? `Elérhető nézetek: ${availableRoleLabel}` : null,
        `Téma: ${topic}`,
        "",
        message,
    ].filter(Boolean).join("\n");

    const escapeHtml = (value: string) => value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Új kapcsolatfelvételi üzenet</h2>
            <ul>
                <li><b>Név:</b> ${escapeHtml(profile.full_name || "-")}</li>
                <li><b>E-mail:</b> ${escapeHtml(profile.email)}</li>
                <li><b>Aktív szerepkör:</b> ${escapeHtml(roleLabel)}</li>
                ${availableRoleLabel ? `<li><b>Elérhető nézetek:</b> ${escapeHtml(availableRoleLabel)}</li>` : ""}
                <li><b>Téma:</b> ${escapeHtml(topic)}</li>
            </ul>
            <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
        </div>
    `;

    const result = await sendEmail({
        to: "indijanmac@gmail.com",
        subject: `Rentapp kapcsolat · ${topic} · ${profile.full_name || profile.email}`,
        html,
        text,
    });

    if (!result.ok) {
        redirect(`/account?status=error&message=${encodeURIComponent(result.error || "Az üzenet küldése nem sikerült.")}#kapcsolat`);
    }

    redirect("/account?status=success&message=Az+%C3%BCzenet+elk%C3%BCldve.+Hamarosan+v%C3%A1laszolunk.#kapcsolat");
}
