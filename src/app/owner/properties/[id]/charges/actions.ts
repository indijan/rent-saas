"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { renderNewChargeEmail } from "@/lib/email/templates";
import pdfParse from "pdf-parse";
import { execFile } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import path from "path";
import { writeFile, readFile, rm } from "fs/promises";
import { extractInvoiceFields } from "@/lib/ai/invoiceExtractor";

type AzureReadLine = {
    text: string;
};

type AzureReadPage = {
    lines?: AzureReadLine[];
};

type AzureReadResult = {
    status?: string;
    analyzeResult?: {
        readResults?: AzureReadPage[];
    };
};

type AzureInvoiceField = {
    valueNumber?: number | null;
    valueCurrency?: {
        amount?: number | null;
        currencyCode?: string | null;
    } | null;
    valueString?: string | null;
    valueDate?: string | null;
};

type AzureInvoiceDocument = {
    fields?: Record<string, AzureInvoiceField>;
};

type AzureInvoicePollResult = {
    status?: string;
    analyzeResult?: {
        documents?: AzureInvoiceDocument[];
    };
};

type ChargeIdRow = {
    id: string | null;
};

type DocumentPathRow = {
    bucket_path: string | null;
};

function parseAmount(value: string) {
    const cleaned = value.replace(/[^\d,.-]/g, "").replace(/\s/g, "");
    let normalized = cleaned;
    if (cleaned.includes(",")) {
        normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
        normalized = cleaned.replace(/\./g, "");
    }
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : null;
}

function safeFileName(value: string) {
    return value.replaceAll(" ", "_").replace(/[^a-zA-Z0-9._-]/g, "");
}

const execFileAsync = promisify(execFile);

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDiacritics(value: string) {
    return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizeLabelText(text: string) {
    return normalizeDiacritics(text)
        .replace(/[0]/g, "o")
        .replace(/[1]/g, "l")
        .replace(/[5]/g, "s")
        .replace(/[6]/g, "o")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function decodeShiftedText(text: string) {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i += 1) {
        bytes[i] = (text.charCodeAt(i) + 29) & 0xff;
    }
    try {
        return new TextDecoder("windows-1250").decode(bytes);
    } catch {
        return String.fromCharCode(...bytes);
    }
}

function isLikelyMvm(text: string) {
    if (/\bmvm\b/i.test(text)) return true;
    const decoded = decodeShiftedText(text);
    return /\bmvm\b/i.test(decoded);
}

function parseHungarianAmount(raw: string | null) {
    if (!raw) return null;
    const cleaned = raw.replace(/Ft|HUF/gi, "").replace(/\s/g, "");
    const digits = cleaned.replace(/[^\d,.-]/g, "");
    let normalized = digits;
    if (digits.includes(",")) {
        normalized = digits.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(digits)) {
        normalized = digits.replace(/\./g, "");
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}

function normalizeDateValue(raw: string | null) {
    if (!raw) return null;
    const trimmed = raw.trim();
    const dotMatch = trimmed.match(/^(\d{4})[.](\d{2})[.](\d{2})$/);
    if (dotMatch) return `${dotMatch[1]}-${dotMatch[2]}-${dotMatch[3]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    return null;
}

function extractAmountDueFromText(text: string) {
    const normalized = normalizeLabelText(text);
    const noAccents = normalizeLabelText(normalizeDiacritics(text));
    const lines = normalized.split(/\r?\n/);
    const linesNoAccents = noAccents.split(/\r?\n/);
    const candidates = [lines, linesNoAccents];
    const rawLines = text.split(/\r?\n/);

    for (const list of candidates) {
        for (let i = 0; i < list.length; i += 1) {
            const line = list[i];
            const match = line.match(/Fizetendo\s+osszeg\s*[:\s]*([0-9 .,-]+(?:Ft|HUF)?)/i);
            if (match?.[1]) {
                return parseHungarianAmount(match[1]);
            }
            if (/Fizetendo\s+osszeg/i.test(line) && list[i + 1]) {
                const valMatch = list[i + 1].match(/([0-9 .,-]+(?:Ft|HUF)?)/i);
                if (valMatch?.[1]) return parseHungarianAmount(valMatch[1]);
                const rawMatch = rawLines[i + 1]?.match(/([0-9 .,-]+(?:Ft|HUF)?)/i);
                if (rawMatch?.[1]) return parseHungarianAmount(rawMatch[1]);
            }
            if (/Fizetendo\s+osszeg/i.test(line) && rawLines[i]) {
                const rawLineMatch = rawLines[i].match(/([0-9 .,-]+(?:Ft|HUF)?)/i);
                if (rawLineMatch?.[1]) return parseHungarianAmount(rawLineMatch[1]);
            }
        }
    }
    return null;
}

function extractDueDateFromText(text: string) {
    const normalized = normalizeLabelText(text);
    const noAccents = normalizeLabelText(normalizeDiacritics(text));
    const lines = normalized.split(/\r?\n/);
    const linesNoAccents = noAccents.split(/\r?\n/);
    const candidates = [lines, linesNoAccents];
    const rawLines = text.split(/\r?\n/);

    for (const list of candidates) {
        for (let i = 0; i < list.length; i += 1) {
            const line = list[i];
            const match = line.match(/Fizetesi\s+hatarido\s*[:\s]*([0-9./-]+)/i);
            if (match?.[1]) {
                return normalizeDateValue(match[1]);
            }
            if (/Fizetesi\s+hatarido/i.test(line) && list[i + 1]) {
                const valMatch = list[i + 1].match(/([0-9]{4}[./-][0-9]{2}[./-][0-9]{2})/);
                if (valMatch?.[1]) return normalizeDateValue(valMatch[1]);
                const rawMatch = rawLines[i + 1]?.match(/([0-9]{4}[./-][0-9]{2}[./-][0-9]{2})/);
                if (rawMatch?.[1]) return normalizeDateValue(rawMatch[1]);
            }
            if (/Fizetesi\s+hatarido/i.test(line) && rawLines[i]) {
                const rawLineMatch = rawLines[i].match(/([0-9]{4}[./-][0-9]{2}[./-][0-9]{2})/);
                if (rawLineMatch?.[1]) return normalizeDateValue(rawLineMatch[1]);
            }
        }
    }
    return null;
}

async function runTesseractOCR(buffer: Buffer) {
    const tmpBase = path.join(tmpdir(), `rent-saas-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inputPath = `${tmpBase}.pdf`;
    const outputBase = `${tmpBase}-out`;
    const outputTxt = `${outputBase}.txt`;
    try {
        await writeFile(inputPath, buffer);
        await execFileAsync("tesseract", [inputPath, outputBase, "-l", "hun+eng", "--dpi", "300"]);
        const text = await readFile(outputTxt, "utf8");
        return text.trim();
    } catch {
        return "";
    } finally {
        await rm(inputPath, { force: true });
        await rm(outputTxt, { force: true });
    }
}

async function runOcrSpaceOCR(buffer: Buffer, filename = "invoice.pdf", mime = "application/pdf", engine = "2") {
    const apiKey = process.env.OCR_SPACE_API_KEY;
    if (!apiKey) return { text: "", error: "OCR_SPACE_API_KEY nincs beállítva." };
    const form = new FormData();
    form.append("apikey", apiKey);
    form.append("language", process.env.OCR_SPACE_LANGUAGE || "eng");
    form.append("OCREngine", engine);
    form.append("isOverlayRequired", "false");
    form.append("scale", "true");
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), filename);

    try {
        const res = await fetch("https://api.ocr.space/parse/image", {
            method: "POST",
            body: form,
        });
        if (!res.ok) {
            return { text: "", error: `OCR.space HTTP ${res.status}` };
        }
        const json = await res.json();
        if (json?.IsErroredOnProcessing) {
            return { text: "", error: String(json?.ErrorMessage || "OCR.space error") };
        }
        const parsedText = json?.ParsedResults?.[0]?.ParsedText;
        return { text: typeof parsedText === "string" ? parsedText.trim() : "", error: null };
    } catch (err: unknown) {
        return { text: "", error: err instanceof Error ? err.message : "OCR.space fetch error" };
    }
}

async function runAzureReadOCR(buffer: Buffer) {
    const endpoint = process.env.AZURE_OCR_ENDPOINT;
    const apiKey = process.env.AZURE_OCR_KEY;
    if (!endpoint || !apiKey) return { text: "", error: "Azure OCR nincs beállítva." };

    const url = `${endpoint.replace(/\/$/, "")}/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": apiKey,
                "Content-Type": "application/pdf",
            },
            body: new Uint8Array(buffer),
        });
        if (!res.ok) {
            return { text: "", error: `Azure OCR HTTP ${res.status}` };
        }
        const opLocation = res.headers.get("operation-location");
        if (!opLocation) return { text: "", error: "Azure OCR operation-location hiányzik." };

        for (let i = 0; i < 12; i += 1) {
            await sleep(1000);
            const poll = await fetch(opLocation, {
                headers: {
                    "Ocp-Apim-Subscription-Key": apiKey,
                },
            });
            if (!poll.ok) return { text: "", error: `Azure OCR poll HTTP ${poll.status}` };
            const json = await poll.json() as AzureReadResult;
            if (json?.status === "succeeded") {
                const lines = json?.analyzeResult?.readResults?.flatMap((page) =>
                    (page?.lines ?? []).map((line) => line.text)
                ) ?? [];
                return { text: lines.join("\n").trim(), error: null };
            }
            if (json?.status === "failed") {
                return { text: "", error: "Azure OCR failed" };
            }
        }
        return { text: "", error: "Azure OCR timeout" };
    } catch (err: unknown) {
        return { text: "", error: err instanceof Error ? err.message : "Azure OCR fetch error" };
    }
}

async function renderPdfFirstPage(buffer: Buffer) {
    const tmpBase = path.join(tmpdir(), `rent-saas-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inputPath = `${tmpBase}.pdf`;
    const outputBase = `${tmpBase}-page`;
    const outputPng = `${outputBase}-1.png`;
    try {
        await writeFile(inputPath, buffer);
        await execFileAsync("pdftoppm", ["-f", "1", "-l", "1", "-png", "-gray", "-r", "400", inputPath, outputBase]);
        const img = await readFile(outputPng);
        return img;
    } catch {
        return null;
    } finally {
        await rm(inputPath, { force: true });
        await rm(outputPng, { force: true });
    }
}

function daysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}

function addMonths(dateStr: string, offset: number) {
    const [yearStr, monthStr, dayStr] = dateStr.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) return dateStr;

    const total = year * 12 + (month - 1) + offset;
    const nextYear = Math.floor(total / 12);
    const nextMonth = (total % 12) + 1;
    const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${nextYear}-${pad(nextMonth)}-${pad(nextDay)}`;
}

export async function createCharge(propertyId: string, formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const title = String(formData.get("title") || "").trim();
    const amountRaw = String(formData.get("amount") || "").trim();
    const amount = parseAmount(amountRaw);
    const due_date = String(formData.get("due_date") || "").trim();
    const type = String(formData.get("type") || "RENT");
    const currency = String(formData.get("currency") || "HUF").trim().toUpperCase() || "HUF";
    const isRecurring = String(formData.get("recurring") || "") === "on";
    const document = formData.get("document");
    const rawDocumentFile = document instanceof File ? document : null;
    const documentFile = rawDocumentFile && rawDocumentFile.size > 0 ? rawDocumentFile : null;

    if (!title || !due_date || amount === null) {
        return { ok: false, error: "A megnevezés, az összeg és az esedékesség kötelező." };
    }
    if (documentFile && documentFile.type !== "application/pdf") {
        return { ok: false, error: "Csak olvasható PDF tölthető fel." };
    }

    const { data: property, error: propErr } = await supabase
        .from("properties")
        .select("id,tenant_id,name")
        .eq("id", propertyId)
        .single();

    if (propErr || !property) return { ok: false, error: "Az ingatlan nem található." };

    const recurringCount = isRecurring ? 12 : 1;
    const recurringGroup = isRecurring ? randomUUID() : null;
    const rows = Array.from({ length: recurringCount }, (_, i) => ({
        property_id: propertyId,
        owner_id: user.id,
        tenant_id: property.tenant_id, // ha van tenant, automatikusan kapja
        type,
        title,
        amount,
        currency,
        due_date: addMonths(due_date, i),
        status: "UNPAID",
        recurring_group: recurringGroup,
        recurring_index: isRecurring ? i + 1 : null,
        recurring_count: isRecurring ? recurringCount : null,
    }));

    const { data: createdCharges, error } = await supabase
        .from("charges")
        .insert(rows)
        .select("id");

    if (error) return { ok: false, error: error.message };
    const createdIds = ((createdCharges ?? []) as ChargeIdRow[])
        .map((row) => row.id)
        .filter((id): id is string => Boolean(id));

    if (documentFile && createdIds.length > 0) {
        const buffer = Buffer.from(await documentFile.arrayBuffer());
        const safeName = safeFileName(documentFile.name || "invoice.pdf") || "invoice.pdf";
        const path = `${user.id}/${createdIds[0]}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
            .from("documents")
            .upload(path, buffer, { contentType: documentFile.type, upsert: false });

        if (upErr) {
            await supabase.from("charges").delete().in("id", createdIds);
            return { ok: false, error: "Dokumentum feltöltés sikertelen, a díj nem jött létre." };
        }

        const { error: docErr } = await supabase.from("documents").insert({
            owner_id: user.id,
            tenant_id: property.tenant_id,
            property_id: propertyId,
            charge_id: createdIds[0],
            bucket_path: path,
            type: "INVOICE",
        });

        if (docErr) {
            await supabase.storage.from("documents").remove([path]);
            await supabase.from("charges").delete().in("id", createdIds);
            return { ok: false, error: "Dokumentum mentés sikertelen, a díj nem jött létre." };
        }
    }

    if (property.tenant_id) {
        const admin = createSupabaseAdminClient();
        const { data: tenantProfile } = await admin
            .from("profiles")
            .select("email")
            .eq("id", property.tenant_id)
            .single();

        if (tenantProfile?.email) {
            const emailPayload = renderNewChargeEmail({
                tenantEmail: tenantProfile.email,
                title,
                amount,
                currency: "HUF",
                dueDate: due_date,
                propertyName: property.name,
                count: recurringCount,
            });
            await sendEmail(emailPayload);
        }
    }
    revalidatePath(`/owner/properties/${propertyId}/charges`);
    return { ok: true };
}

type AzureInvoiceFields = {
    name: string | null;
    amount: number | null;
    currency: string | null;
    due_date: string | null;
};

async function runAzureInvoiceOCR(buffer: Buffer): Promise<{ data: AzureInvoiceFields | null; error: string | null; debugFields?: string[] }> {
    const endpoint = process.env.AZURE_OCR_ENDPOINT;
    const apiKey = process.env.AZURE_OCR_KEY;
    if (!endpoint || !apiKey) return { data: null, error: "Azure OCR nincs beállítva." };

    const modelId = process.env.AZURE_OCR_MODEL_ID?.trim() || "prebuilt-invoice";
    const url = `${endpoint.replace(/\/$/, "")}/formrecognizer/documentModels/${modelId}:analyze?api-version=2023-07-31`;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Ocp-Apim-Subscription-Key": apiKey,
                "Content-Type": "application/pdf",
            },
            body: new Uint8Array(buffer),
        });
        if (!res.ok) {
            return { data: null, error: `Azure Invoice HTTP ${res.status}` };
        }
        const opLocation = res.headers.get("operation-location");
        if (!opLocation) return { data: null, error: "Azure Invoice operation-location hiányzik." };

        for (let i = 0; i < 12; i += 1) {
            await sleep(1000);
            const poll = await fetch(opLocation, {
                headers: {
                    "Ocp-Apim-Subscription-Key": apiKey,
                },
            });
            if (!poll.ok) return { data: null, error: `Azure Invoice poll HTTP ${poll.status}` };
            const json = await poll.json() as AzureInvoicePollResult;
            if (json?.status === "succeeded") {
                const doc = json?.analyzeResult?.documents?.[0];
                const fields = doc?.fields ?? {};
                const normalizeKey = (value: string) =>
                    normalizeDiacritics(value).toLowerCase().replace(/\s+/g, " ").trim();
                const getFieldByName = (target: string) => {
                    const targetNorm = normalizeKey(target);
                    const key = Object.keys(fields).find((k) => normalizeKey(k) === targetNorm);
                    return key ? fields[key] : null;
                };
                const getNumber = (field: AzureInvoiceField | null) =>
                    field?.valueNumber ?? field?.valueCurrency?.amount ?? null;
                const getRawString = (field: AzureInvoiceField | null) =>
                    field?.valueString ?? null;
                const getCurrency = (field: AzureInvoiceField | null) =>
                    field?.valueCurrency?.currencyCode ?? null;
                const getString = (field: AzureInvoiceField | null) =>
                    field?.valueString ?? null;
                const getDate = (field: AzureInvoiceField | null) =>
                    field?.valueDate ?? field?.valueString ?? null;
                const parseAmount = (field: AzureInvoiceField | null) => {
                    const numeric = getNumber(field);
                    if (Number.isFinite(numeric)) return Number(numeric);
                    const raw = getRawString(field);
                    return raw ? parseHungarianAmount(raw) : null;
                };
                const extractCurrency = (field: AzureInvoiceField | null) => {
                    const code = getCurrency(field);
                    if (code) return String(code).toUpperCase();
                    const raw = getRawString(field);
                    return raw && /Ft|HUF/i.test(raw) ? "HUF" : null;
                };

                const vendorName = fields?.VendorName?.valueString
                    ?? getString(getFieldByName("Szolgáltató neve"))
                    ?? getString(getFieldByName("Szolgaltato neve"))
                    ?? null;
                const amountDue = parseAmount(fields?.AmountDue)
                    ?? parseAmount(getFieldByName("Fizetendő összeg"))
                    ?? parseAmount(getFieldByName("Fizetendo osszeg"))
                    ?? null;
                const invoiceTotal = parseAmount(fields?.InvoiceTotal) ?? null;
                const currency = extractCurrency(fields?.AmountDue)
                    ?? extractCurrency(getFieldByName("Fizetendő összeg"))
                    ?? extractCurrency(fields?.InvoiceTotal)
                    ?? null;
                const dueDateRaw = getDate(fields?.DueDate)
                    ?? getDate(getFieldByName("Fizetési határidő"))
                    ?? getDate(getFieldByName("Fizetesi hatarido"))
                    ?? null;
                const dueDate = dueDateRaw ? normalizeDateValue(String(dueDateRaw)) : null;
                return {
                    data: {
                        name: vendorName,
                        amount: Number.isFinite(amountDue) ? Number(amountDue)
                            : (Number.isFinite(invoiceTotal) ? Number(invoiceTotal) : null),
                        currency: currency ? String(currency).toUpperCase() : null,
                        due_date: dueDate ? String(dueDate) : null,
                    },
                    debugFields: Object.keys(fields),
                    error: null,
                };
            }
            if (json?.status === "failed") {
                return { data: null, error: "Az Azure számlafeldolgozás sikertelen." };
            }
        }
        return { data: null, error: "Az Azure számlafeldolgozás időtúllépéssel leállt." };
    } catch (err: unknown) {
        return { data: null, error: err instanceof Error ? err.message : "Azure Invoice fetch error" };
    }
}

export async function extractInvoiceData(formData: FormData) {
    await requireRole("OWNER");

    const document = formData.get("document");
    const documentFile = document instanceof File ? document : null;
    if (!documentFile || documentFile.size === 0) {
        return { ok: false, error: "Nincs kiválasztott PDF." };
    }
    if (documentFile.type !== "application/pdf") {
        return { ok: false, error: "Csak olvasható PDF-et tölts fel." };
    }

    const buffer = Buffer.from(await documentFile.arrayBuffer());
    return extractInvoiceFromBuffer(buffer);
}

export async function extractInvoiceFromBuffer(buffer: Buffer) {
    const pdf = await pdfParse(buffer);
    const textFromPdf = (pdf.text || "").trim();
    let text = textFromPdf;
    let ocrUsed = false;
    let ocrProvider: string | null = null;
    let ocrError: string | null = null;

    const hasMvm = isLikelyMvm(textFromPdf);
    if (hasMvm) {
        const png = await renderPdfFirstPage(buffer);
        if (png) {
            const ocrImage = await runOcrSpaceOCR(png, "invoice.png", "image/png", "2");
            let imageText = ocrImage.text;
            if (!/Fizetend/i.test(imageText)) {
                const ocrImageAlt = await runOcrSpaceOCR(png, "invoice.png", "image/png", "1");
                if (ocrImageAlt.text) {
                    imageText = [imageText, ocrImageAlt.text].filter(Boolean).join("\n");
                }
            }
            if (imageText) {
                text = imageText;
                ocrUsed = true;
                ocrProvider = "ocr.space-image";
            } else if (ocrImage.error) {
                ocrError = ocrImage.error;
            }
        } else {
            ocrError = "pdftoppm nem futott le (nincs telepítve?)";
        }
    }

    if (!text) {
        return {
            ok: false,
            error: "A PDF nem tartalmaz olvasható szöveget (OCR sem talált).",
            debug: process.env.AI_DEBUG === "true"
                ? { pages: pdf.numpages ?? null, textLength: 0, sample: "", ocrUsed, ocrProvider, ocrError }
                : undefined,
        };
    }

    const azureInvoice = hasMvm ? await runAzureInvoiceOCR(buffer) : { data: null, error: null };

    const aiRes = await extractInvoiceFields(text);
    if (!aiRes.ok || !aiRes.data) return { ok: false, error: aiRes.error };
    const labeledAmount = extractAmountDueFromText(text);
    const labeledDue = extractDueDateFromText(text);
    const hasPayableLabel = /fizetend/i.test(text);
    const hasMiho = /mih[őo]/i.test(text) || /miskolci\s+h[oő]szolg[aá]ltat[oó]/i.test(text);
    const hasTelekom = /telekom/i.test(text);
    const aiAmountSafe = Number.isFinite(aiRes.data.amount ?? NaN) ? (aiRes.data.amount as number) : null;
    const merged = {
        amount: aiRes.data.amount,
        currency: aiRes.data.currency,
        due_date: aiRes.data.due_date,
        name: aiRes.data.name,
        type: aiRes.data.type,
    };
    const azureAmount = (azureInvoice.data?.amount !== null && azureInvoice.data?.amount !== undefined)
        ? azureInvoice.data.amount
        : null;
    const labeledAmountSafe = (labeledAmount !== null && labeledAmount !== undefined && labeledAmount !== 0)
        ? labeledAmount
        : null;
    if (azureInvoice.data) {
        const modelId = process.env.AZURE_OCR_MODEL_ID ?? "prebuilt-invoice";
        const isCustomModel = modelId !== "prebuilt-invoice";
        const trustedAzureAmount = (hasMvm && isCustomModel)
            ? azureAmount
            : ((!hasMvm && !hasMiho && hasPayableLabel) ? azureAmount : null);
        merged.amount = labeledAmountSafe ?? aiAmountSafe ?? trustedAzureAmount ?? merged.amount;
        merged.currency = azureInvoice.data.currency ?? merged.currency;
        merged.due_date = labeledDue ?? azureInvoice.data.due_date ?? merged.due_date;
        merged.name = azureInvoice.data.name ?? merged.name;
    } else {
        merged.amount = labeledAmountSafe ?? aiAmountSafe ?? merged.amount;
        merged.due_date = labeledDue ?? merged.due_date;
    }
    if (hasTelekom) {
        merged.name = "Magyar Telekom";
    }
    return {
        ok: true,
        data: merged,
        debug: process.env.AI_DEBUG === "true"
            ? {
                pages: pdf.numpages ?? null,
                textLength: text.length,
                sample: text.slice(0, 500),
                ocrUsed,
                ocrProvider,
                ocrError,
                azureInvoice: Boolean(azureInvoice.data),
                azureInvoiceError: azureInvoice.error ?? null,
                azureModelId: process.env.AZURE_OCR_MODEL_ID ?? "prebuilt-invoice",
                azureFields: azureInvoice.debugFields ?? null,
                amounts: {
                    labeled: labeledAmountSafe,
                    azure: azureAmount,
                    azureTrusted: hasPayableLabel ? azureAmount : null,
                    ai: aiRes.data.amount ?? null,
                },
            }
            : undefined,
    };
}

export async function markChargePaid(chargeId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("property_id,status")
        .eq("id", chargeId)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "A díj nem található." };
    if (charge.status !== "UNPAID") return { ok: false, error: "Csak aktív díj jelölhető fizetettnek." };

    const { error } = await supabase
        .from("charges")
        .update({
            status: "PAID",
            paid_at: new Date().toISOString(),
        })
        .eq("id", chargeId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath(`/owner/properties/${charge.property_id}/charges`);
    return { ok: true };
}

export async function publishCharge(chargeId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("id,property_id,tenant_id,status,title,amount,currency,due_date,properties(name)")
        .eq("id", chargeId)
        .eq("owner_id", user.id)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "A díj nem található." };
    if (charge.status !== "IMPORT_DRAFT") return { ok: false, error: "Csak piszkozat státuszú díj publikálható." };

    const { error } = await supabase
        .from("charges")
        .update({ status: "UNPAID" })
        .eq("id", chargeId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };

    if (charge.tenant_id) {
        const admin = createSupabaseAdminClient();
        const { data: tenantProfile } = await admin
            .from("profiles")
            .select("email")
            .eq("id", charge.tenant_id)
            .single();

        if (tenantProfile?.email) {
            const propertyValue = (charge as { properties?: { name: string | null }[] | { name: string | null } | null }).properties;
            const property = Array.isArray(propertyValue) ? propertyValue[0] : propertyValue;
            const emailPayload = renderNewChargeEmail({
                tenantEmail: tenantProfile.email,
                title: charge.title,
                amount: Number(charge.amount),
                currency: String(charge.currency || "HUF"),
                dueDate: String(charge.due_date),
                propertyName: property?.name ?? null,
                count: 1,
            });
            await sendEmail(emailPayload);
        }
    }

    revalidatePath(`/owner/properties/${charge.property_id}/charges`);
    return { ok: true };
}

export async function updateCharge(chargeId: string, formData: FormData) {
    const { supabase, user } = await requireRole("OWNER");

    const title = String(formData.get("title") || "").trim();
    const amountRaw = String(formData.get("amount") || "").trim();
    const amount = parseAmount(amountRaw);
    const due_date = String(formData.get("due_date") || "").trim();
    const type = String(formData.get("type") || "RENT").trim();
    const currency = String(formData.get("currency") || "HUF").trim().toUpperCase() || "HUF";

    if (!title || !due_date || amount === null) {
        return { ok: false, error: "A megnevezés, az összeg és az esedékesség kötelező." };
    }

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("property_id,status,paid_at")
        .eq("id", chargeId)
        .eq("owner_id", user.id)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "A díj nem található." };
    if (charge.status !== "UNPAID" && charge.status !== "IMPORT_DRAFT") {
        return { ok: false, error: "Csak aktív vagy piszkozat státuszú díj szerkeszthető." };
    }

    const { error } = await supabase
        .from("charges")
        .update({
            title,
            type,
            amount,
            currency,
            due_date,
            status: charge.status,
            paid_at: charge.paid_at,
        })
        .eq("id", chargeId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath(`/owner/properties/${charge.property_id}/charges`);
    return { ok: true };
}

export async function cancelCharge(chargeId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("property_id,status")
        .eq("id", chargeId)
        .eq("owner_id", user.id)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "A díj nem található." };
    if (charge.status === "PAID" || charge.status === "ARCHIVED") {
        return { ok: false, error: "Fizetett vagy archivált díj nem sztornózható." };
    }

    const { error } = await supabase
        .from("charges")
        .update({
            status: "CANCELLED",
        })
        .eq("id", chargeId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath(`/owner/properties/${charge.property_id}/charges`);
    return { ok: true };
}

export async function restoreCharge(chargeId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("property_id,status")
        .eq("id", chargeId)
        .eq("owner_id", user.id)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "A díj nem található." };
    if (charge.status !== "CANCELLED") return { ok: false, error: "Csak törölt díj állítható vissza." };

    const { error } = await supabase
        .from("charges")
        .update({ status: "UNPAID" })
        .eq("id", chargeId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath(`/owner/properties/${charge.property_id}/charges`);
    return { ok: true };
}

export async function archiveCharge(chargeId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("property_id,status")
        .eq("id", chargeId)
        .eq("owner_id", user.id)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "A díj nem található." };
    if (charge.status !== "PAID") return { ok: false, error: "Csak fizetett díj archiválható." };

    const { error } = await supabase
        .from("charges")
        .update({ status: "ARCHIVED" })
        .eq("id", chargeId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath(`/owner/properties/${charge.property_id}/charges`);
    return { ok: true };
}

export async function deleteCharge(chargeId: string) {
    const { supabase, user } = await requireRole("OWNER");

    const { data: charge, error: chargeErr } = await supabase
        .from("charges")
        .select("property_id,status")
        .eq("id", chargeId)
        .eq("owner_id", user.id)
        .single();

    if (chargeErr || !charge) return { ok: false, error: "A díj nem található." };
    if (charge.status !== "UNPAID" && charge.status !== "IMPORT_DRAFT" && charge.status !== "CANCELLED") {
        return { ok: false, error: "Csak aktív, piszkozat vagy érvénytelenített díj törölhető véglegesen." };
    }

    const { data: docs, error: docsErr } = await supabase
        .from("documents")
        .select("bucket_path")
        .eq("charge_id", chargeId);

    if (docsErr) return { ok: false, error: docsErr.message };

    const paths = ((docs ?? []) as DocumentPathRow[])
        .map((doc) => doc.bucket_path)
        .filter((path): path is string => Boolean(path));
    if (paths.length > 0) {
        const { error: storageErr } = await supabase.storage
            .from("documents")
            .remove(paths);
        if (storageErr) return { ok: false, error: storageErr.message };
    }

    const { error: docErr } = await supabase
        .from("documents")
        .delete()
        .eq("charge_id", chargeId);

    if (docErr) return { ok: false, error: docErr.message };

    const { error } = await supabase
        .from("charges")
        .delete()
        .eq("id", chargeId)
        .eq("owner_id", user.id);

    if (error) return { ok: false, error: error.message };
    revalidatePath(`/owner/properties/${charge.property_id}/charges`);
    return { ok: true };
}
