import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAvailableRoles } from "@/lib/auth/availableRoles";
import { getChargeTypeLabel } from "@/lib/chargeTypes";
import type { AppRole } from "@/lib/auth/requireUser";

type UserContext = {
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    userId: string;
};

type ExportRow = {
    title: string | null;
    type: string | null;
    amount: number | string | null;
    currency: string | null;
    due_date: string | null;
    status: string | null;
    paid_at: string | null;
    tenant_id: string | null;
    property_id: string | null;
    properties?: { name: string | null; address: string | null } | { name: string | null; address: string | null }[] | null;
};

async function requireOwner(): Promise<UserContext | NextResponse> {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (error || !profile?.role) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const roles = await resolveAvailableRoles(user.id, profile.role as AppRole);
    if (!roles.includes("OWNER")) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    return { supabase, userId: user.id };
}

function escapeCsv(value: unknown) {
    const text = String(value ?? "");
    if (/[",\n\r]/.test(text)) {
        return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
}

function firstRelation<T>(value: T | T[] | null | undefined) {
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function statusLabel(status: string | null, dueDate: string | null) {
    if (status === "UNPAID" && dueDate) {
        const due = new Date(`${dueDate}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (due.getTime() < today.getTime()) return "Lejárt";
    }
    switch (status) {
        case "UNPAID":
            return "Aktív";
        case "PAID":
            return "Fizetett";
        case "ARCHIVED":
            return "Archivált";
        case "IMPORT_DRAFT":
            return "Piszkozat";
        case "CANCELLED":
            return "Sztornó";
        default:
            return status ?? "";
    }
}

export async function GET(request: NextRequest) {
    const ctx = await requireOwner();
    if (ctx instanceof NextResponse) return ctx;

    const url = new URL(request.url);
    const property = url.searchParams.get("property") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const type = url.searchParams.get("type") ?? "";
    const billing = url.searchParams.get("billing") ?? "";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";

    let query = ctx.supabase
        .from("charges")
        .select("title,type,amount,currency,due_date,status,paid_at,tenant_id,property_id,properties(name,address)")
        .eq("owner_id", ctx.userId)
        .order("due_date", { ascending: false });

    if (property) query = query.eq("property_id", property);
    if (status === "OVERDUE") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isoToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        query = query.eq("status", "UNPAID").lt("due_date", isoToday);
    } else if (status) {
        query = query.eq("status", status);
    }
    if (type) query = query.eq("type", type);
    if (billing === "OWN") query = query.is("tenant_id", null).neq("type", "RENT");
    if (billing === "TENANT") query = query.not("tenant_id", "is", null);
    if (from) query = query.gte("due_date", from);
    if (to) query = query.lte("due_date", to);

    const { data, error } = await query;
    if (error) return new NextResponse(error.message, { status: 500 });

    const headers = [
        "property_name",
        "property_address",
        "title",
        "type_label",
        "amount",
        "currency",
        "due_date",
        "status_label",
        "paid_at",
        "billing_mode",
        "tenant_id",
    ];

    const rows = ((data ?? []) as ExportRow[]).map((row) => {
        const propertyRow = firstRelation(row.properties);
        const billingMode = !row.tenant_id && row.type !== "RENT" ? "Saját költség" : "Továbbított költség";
        return [
            propertyRow?.name ?? "",
            propertyRow?.address ?? "",
            row.title ?? "",
            getChargeTypeLabel(row.type ?? "", row.tenant_id),
            row.amount ?? "",
            row.currency ?? "",
            row.due_date ?? "",
            statusLabel(row.status, row.due_date),
            row.paid_at ?? "",
            billingMode,
            row.tenant_id ?? "",
        ];
    });

    const csv = [
        headers.map(escapeCsv).join(","),
        ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\r\n");

    return new NextResponse(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": "attachment; filename=\"owner-finance-export.csv\"",
        },
    });
}
