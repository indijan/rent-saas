import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "crypto";

export type InboundMailboxRow = {
    id: string;
    owner_id: string;
    local_part: string;
    email_address: string;
    is_active: boolean;
    created_at: string;
};

function buildRandomLocalPart() {
    return `szamla-${randomBytes(3).toString("hex")}`;
}

function getInboundDomain() {
    return process.env.INBOUND_EMAIL_DOMAIN || "in.rentapp.hu";
}

function buildEmailAddress(localPart: string) {
    return `${localPart}@${getInboundDomain()}`;
}

async function insertMailbox(ownerId: string) {
    const admin = createSupabaseAdminClient();

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const localPart = buildRandomLocalPart();
        const emailAddress = buildEmailAddress(localPart);

        const { data, error } = await admin
            .from("inbound_mailboxes")
            .insert({
                owner_id: ownerId,
                local_part: localPart,
                email_address: emailAddress,
                is_active: true,
            })
            .select("id,owner_id,local_part,email_address,is_active,created_at")
            .single();

        if (!error && data) {
            return data as InboundMailboxRow;
        }

        if (!error || error.code !== "23505") {
            throw error || new Error("A bejövő postafiók létrehozása nem sikerült.");
        }
    }

    throw new Error("Nem sikerült egyedi bejövő e-mail-címet generálni.");
}

async function updateMailbox(ownerId: string) {
    const admin = createSupabaseAdminClient();

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const localPart = buildRandomLocalPart();
        const emailAddress = buildEmailAddress(localPart);

        const { data, error } = await admin
            .from("inbound_mailboxes")
            .update({
                local_part: localPart,
                email_address: emailAddress,
                is_active: true,
            })
            .eq("owner_id", ownerId)
            .select("id,owner_id,local_part,email_address,is_active,created_at")
            .single();

        if (!error && data) {
            return data as InboundMailboxRow;
        }

        if (!error || error.code !== "23505") {
            throw error || new Error("A bejövő postafiók cseréje nem sikerült.");
        }
    }

    throw new Error("Nem sikerült új bejövő e-mail-címet generálni.");
}

export async function getOrCreateInboundMailbox(ownerId: string) {
    const admin = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await admin
        .from("inbound_mailboxes")
        .select("id,owner_id,local_part,email_address,is_active,created_at")
        .eq("owner_id", ownerId)
        .maybeSingle();

    if (existingError) throw existingError;
    if (existing) return existing as InboundMailboxRow;

    return insertMailbox(ownerId);
}

export async function rotateInboundMailbox(ownerId: string) {
    const existing = await getOrCreateInboundMailbox(ownerId);
    if (!existing) {
        throw new Error("A bejövő postafiók nem található.");
    }

    return updateMailbox(ownerId);
}
