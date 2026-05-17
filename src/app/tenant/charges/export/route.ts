import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAvailableRoles } from "@/lib/auth/availableRoles";
import type { AppRole } from "@/lib/auth/requireUser";

type UserContext = {
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    userId: string;
};

type TenantChargeExportRow = {
    title: string | null;
    type: string | null;
    amount: number | string | null;
    currency: string | null;
    due_date: string | null;
    status: string | null;
    paid_at: string | null;
    properties?: { name: string | null; address: string | null }[] | { name: string | null; address: string | null } | null;
};

async function requireTenant(): Promise<UserContext | NextResponse> {
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
    if (!roles.includes("TENANT")) {
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

export async function GET(request: Request) {
    const ctx = await requireTenant();
    if (ctx instanceof NextResponse) return ctx;

    const url = new URL(request.url);
    const propertyId = url.searchParams.get("property") ?? "";
    const status = url.searchParams.get("status") ?? "";
    const type = url.searchParams.get("type") ?? "";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";

    let q = ctx.supabase
        .from("charges")
        .select("title,type,amount,currency,due_date,status,paid_at,properties(name,address)")
        .eq("tenant_id", ctx.userId)
        .neq("status", "IMPORT_DRAFT")
        .order("due_date", { ascending: false });

    if (propertyId) q = q.eq("property_id", propertyId);
    if (status) q = q.eq("status", status);
    if (type) q = q.eq("type", type);
    if (from) q = q.gte("due_date", from);
    if (to) q = q.lte("due_date", to);

    const { data, error } = await q;
    if (error) return new NextResponse(error.message, { status: 500 });

    const headers = [
        "property_name",
        "property_address",
        "title",
        "type",
        "amount",
        "currency",
        "due_date",
        "status",
        "paid_at",
    ];

    const rows = ((data ?? []) as TenantChargeExportRow[]).map((row) => {
        const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
        return [
        property?.name ?? "",
        property?.address ?? "",
        row.title ?? "",
        row.type ?? "",
        row.amount ?? "",
        row.currency ?? "",
        row.due_date ?? "",
        row.status ?? "",
        row.paid_at ?? "",
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
            "Content-Disposition": "attachment; filename=\"tenant-charges.csv\"",
        },
    });
}
