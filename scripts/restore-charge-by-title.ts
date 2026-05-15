import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const envText = readFileSync(".env.local", "utf8");
for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) {
        process.env[key] = value;
    }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const title = "Számla – MIHŐ – 2026-05-31";

async function main() {
    const { data, error } = await supabase
        .from("charges")
        .select("id,title,status,due_date,property_id,amount,currency")
        .eq("title", title)
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    if (!data || data.length === 0) {
        console.log(`No charge found for title: ${title}`);
        return;
    }

    console.log("Matches:");
    for (const row of data) {
        console.log(JSON.stringify(row));
    }

    const cancelled = data.find((row) => row.status === "CANCELLED");
    if (!cancelled) {
        console.log("No CANCELLED charge found to restore.");
        return;
    }

    const { error: updateError } = await supabase
        .from("charges")
        .update({ status: "UNPAID" })
        .eq("id", cancelled.id);

    if (updateError) {
        throw updateError;
    }

    console.log(`Restored charge ${cancelled.id} to UNPAID.`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
