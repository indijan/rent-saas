import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type UserContext = {
    supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    userId: string;
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

    if (error || profile?.role !== "OWNER") {
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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const ctx = await requireOwner();
    if (ctx instanceof NextResponse) return ctx;

    const propertyId = id;
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "";
    const type = url.searchParams.get("type") ?? "";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";

    const { data: property, error: propErr } = await ctx.supabase
        .from("properties")
        .select("id,name,address")
        .eq("id", propertyId)
        .eq("owner_id", ctx.userId)
        .single();

    if (propErr || !property) {
        return new NextResponse("Not found", { status: 404 });
    }

    let q = ctx.supabase
        .from("charges")
        .select("title,type,amount,currency,due_date,status,paid_at,tenant_id")
        .eq("property_id", propertyId)
        .eq("owner_id", ctx.userId)
        .order("due_date", { ascending: false });

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
        "tenant_id",
    ];

    const rows = (data ?? []).map((row: any) => ([
        property.name ?? "",
        property.address ?? "",
        row.title ?? "",
        row.type ?? "",
        row.amount ?? "",
        row.currency ?? "",
        row.due_date ?? "",
        row.status ?? "",
        row.paid_at ?? "",
        row.tenant_id ?? "",
    ]));

    const csv = [
        headers.map(escapeCsv).join(","),
        ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\r\n");

    return new NextResponse(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": "attachment; filename=\"owner-charges.csv\"",
        },
    });
}
