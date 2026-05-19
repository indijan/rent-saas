import {
    DeleteObjectsCommand,
    GetObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StorageProvider = "supabase" | "r2";

function getStorageProvider(): StorageProvider {
    const provider = (process.env.STORAGE_PROVIDER || "supabase").trim().toLowerCase();
    return provider === "r2" ? "r2" : "supabase";
}

function getSupabaseBucketName() {
    return process.env.SUPABASE_DOCUMENTS_BUCKET || "documents";
}

function getR2BucketName() {
    return process.env.R2_BUCKET || "rentapp";
}

function getR2Client() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error("Hiányzik az R2_ACCOUNT_ID, R2_ACCESS_KEY_ID vagy R2_SECRET_ACCESS_KEY.");
    }

    return new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
}

async function streamToBuffer(stream: AsyncIterable<Uint8Array>) {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export async function uploadDocumentObject(key: string, body: Buffer, contentType?: string) {
    if (getStorageProvider() === "r2") {
        const client = getR2Client();
        await client.send(new PutObjectCommand({
            Bucket: getR2BucketName(),
            Key: key,
            Body: body,
            ContentType: contentType || "application/octet-stream",
        }));
        return;
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.storage
        .from(getSupabaseBucketName())
        .upload(key, body, { contentType, upsert: false });

    if (error) {
        throw new Error(error.message || "A dokumentum feltöltése nem sikerült.");
    }
}

export async function removeDocumentObjects(keys: string[]) {
    if (keys.length === 0) return;

    if (getStorageProvider() === "r2") {
        const client = getR2Client();
        await client.send(new DeleteObjectsCommand({
            Bucket: getR2BucketName(),
            Delete: {
                Objects: keys.map((key) => ({ Key: key })),
                Quiet: true,
            },
        }));
        return;
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin.storage.from(getSupabaseBucketName()).remove(keys);
    if (error) {
        throw new Error(error.message || "A dokumentumok törlése nem sikerült.");
    }
}

export async function downloadDocumentObject(key: string) {
    if (getStorageProvider() === "r2") {
        const client = getR2Client();
        const response = await client.send(new GetObjectCommand({
            Bucket: getR2BucketName(),
            Key: key,
        }));

        if (!response.Body) {
            throw new Error("A dokumentum nem tölthető le.");
        }

        return streamToBuffer(response.Body as AsyncIterable<Uint8Array>);
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage.from(getSupabaseBucketName()).download(key);
    if (error || !data) {
        throw new Error(error?.message || "A dokumentum nem tölthető le.");
    }

    return Buffer.from(await data.arrayBuffer());
}

export async function createDocumentSignedUrl(key: string, expiresIn = 60 * 60) {
    if (getStorageProvider() === "r2") {
        const client = getR2Client();
        return getSignedUrl(client, new GetObjectCommand({
            Bucket: getR2BucketName(),
            Key: key,
        }), { expiresIn });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.storage.from(getSupabaseBucketName()).createSignedUrl(key, expiresIn);
    if (error || !data?.signedUrl) {
        throw new Error(error?.message || "A dokumentumhoz nem sikerült signed URL-t készíteni.");
    }
    return data.signedUrl;
}

export function getConfiguredStorageBucketName() {
    return getStorageProvider() === "r2" ? getR2BucketName() : getSupabaseBucketName();
}
