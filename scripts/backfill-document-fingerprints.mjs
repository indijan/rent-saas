import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_DOCUMENTS_BUCKET || "documents";
const useR2 = (process.env.STORAGE_PROVIDER || "supabase").trim().toLowerCase() === "r2";
const r2Bucket = process.env.R2_BUCKET || "rentapp";
const pageSize = 200;
const concurrency = 8;
const applyChanges = process.argv.includes("--apply");

if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL és SUPABASE_SERVICE_ROLE_KEY szükséges.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const r2Client = useR2 && process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
    ? new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    })
    : null;

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

async function downloadDocument(key) {
    if (useR2 && r2Client) {
        try {
            const result = await r2Client.send(new GetObjectCommand({ Bucket: r2Bucket, Key: key }));
            if (result.Body) return streamToBuffer(result.Body);
        } catch {
            // The app falls back to Supabase Storage if the R2 object is unavailable.
        }
    }

    const { data, error } = await supabase.storage.from(supabaseBucket).download(key);
    if (error || !data) throw new Error(error?.message || "A fájl nem tölthető le.");
    return Buffer.from(await data.arrayBuffer());
}

let processed = 0;
let skipped = 0;
let failed = 0;
let offset = 0;

while (true) {
    const { data: documents, error } = await supabase
        .from("documents")
        .select("id,owner_id,bucket_path")
        .eq("type", "INVOICE")
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);

    if (error) throw new Error(error.message);
    if (!documents?.length) break;

    for (let index = 0; index < documents.length; index += concurrency) {
        const batch = documents.slice(index, index + concurrency);
        const fingerprints = await Promise.all(batch.map(async (document) => {
            if (!String(document.bucket_path || "").toLowerCase().endsWith(".pdf")) {
                skipped += 1;
                return null;
            }

            try {
                const buffer = await downloadDocument(document.bucket_path);
                return {
                    owner_id: document.owner_id,
                    sha256: createHash("sha256").update(buffer).digest("hex"),
                    document_id: document.id,
                };
            } catch (error) {
                failed += 1;
                process.stderr.write(`Nem sikerült: ${document.id} (${error instanceof Error ? error.message : String(error)})\n`);
                return null;
            }
        }));

        const rows = fingerprints.filter(Boolean);
        if (applyChanges && rows.length) {
            const { error: saveError } = await supabase
                .from("document_fingerprints")
                .upsert(rows, { onConflict: "owner_id,sha256", ignoreDuplicates: true });
            if (saveError) throw new Error(saveError.message);
        }
        processed += rows.length;
    }

    offset += documents.length;
    process.stdout.write(`Ellenőrizve: ${offset} dokumentum\n`);
}

process.stdout.write(`${applyChanges ? "Mentve" : "Dry run"}: ${processed} PDF, kihagyva: ${skipped}, hiba: ${failed}\n`);
if (failed) process.exitCode = 1;
