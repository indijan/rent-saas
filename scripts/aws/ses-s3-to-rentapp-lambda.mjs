import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import PostalMime from "postal-mime";

const s3 = new S3Client({});
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

function sanitizeFileName(value) {
  return String(value || "attachment.pdf")
    .replaceAll(" ", "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function loadRawEmail(bucket, key) {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return streamToBuffer(response.Body);
}

async function uploadAttachmentToR2({ messageId, fileName, contentType, content }) {
  const safeName = sanitizeFileName(fileName);
  const storageKey = `inbound-email/${messageId}/${Date.now()}-${safeName}`;
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: storageKey,
    Body: content,
    ContentType: contentType || "application/pdf",
  }));

  return storageKey;
}

async function notifyRentapp(payload) {
  const response = await fetch(process.env.RENTAPP_INBOUND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RENTAPP_INBOUND_PROCESS_SECRET}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Rentapp inbound hiba: ${response.status} ${text}`);
  }

  return response.json();
}

function extractRecipient(parsedEmail) {
  const to = Array.isArray(parsedEmail.to) ? parsedEmail.to : [];
  const first = to[0];
  return first?.address || null;
}

export async function handler(event) {
  const results = [];

  for (const record of event.Records || []) {
    const bucket = record.s3?.bucket?.name;
    const key = decodeURIComponent(record.s3?.object?.key || "").replace(/\+/g, " ");

    if (!bucket || !key) {
      results.push({ ok: false, reason: "Hiányzó S3 bucket vagy key." });
      continue;
    }

    const rawEmail = await loadRawEmail(bucket, key);
    const parser = new PostalMime();
    const parsed = await parser.parse(rawEmail);

    const recipient = extractRecipient(parsed);
    if (!recipient) {
      results.push({ ok: false, bucket, key, reason: "Nem található címzett a levélben." });
      continue;
    }

    const attachments = [];
    for (const attachment of parsed.attachments || []) {
      const fileName = attachment.filename || "attachment.pdf";
      const contentType = attachment.mimeType || "application/octet-stream";
      const isPdf = fileName.toLowerCase().endsWith(".pdf") || contentType === "application/pdf";

      if (!isPdf) {
        continue;
      }

      const content = Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(attachment.content);

      const storageKey = await uploadAttachmentToR2({
        messageId: parsed.messageId || key.replaceAll("/", "_"),
        fileName,
        contentType,
        content,
      });

      attachments.push({
        fileName,
        storageBucket: process.env.R2_BUCKET,
        storageKey,
        contentType: "application/pdf",
      });
    }

    if (attachments.length === 0) {
      results.push({ ok: true, bucket, key, skipped: true, reason: "Nem volt PDF csatolmány." });
      continue;
    }

    const apiResult = await notifyRentapp({
      recipient: recipient.toLowerCase(),
      messageId: parsed.messageId || null,
      from: parsed.from?.address || null,
      subject: parsed.subject || null,
      attachments,
    });

    results.push({
      ok: true,
      bucket,
      key,
      recipient,
      attachments: attachments.length,
      apiResult,
    });
  }

  return { ok: true, results };
}
