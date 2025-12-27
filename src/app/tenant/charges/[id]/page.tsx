import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/requireRole";

type Props = { params: Promise<{ id: string }> };

export default async function TenantChargeDetailPage({ params }: Props) {
    const { id } = await params;
    const { supabase, user } = await requireRole("TENANT");

    const { data: charge, error } = await supabase
        .from("charges")
        .select("id,title,type,amount,currency,due_date,status,paid_at,notes,properties(name,address)")
        .eq("id", id)
        .eq("tenant_id", user.id)
        .single();

    if (error || !charge) return notFound();

    const { data: documents } = await supabase
        .from("documents")
        .select("id,bucket_path,created_at")
        .eq("charge_id", id)
        .order("created_at", { ascending: false });

    const documentsWithUrls = await Promise.all(
        (documents ?? []).map(async (doc: any) => {
            const { data } = await supabase.storage
                .from("documents")
                .createSignedUrl(doc.bucket_path, 60 * 60);
            return { ...doc, signed_url: data?.signedUrl ?? "" };
        })
    );

    const property = Array.isArray(charge.properties) ? charge.properties[0] : charge.properties;

    return (
        <main className="app-shell page-enter space-y-4">
            <Link className="link text-sm" href="/tenant/charges">
                ← Vissza
            </Link>

            <h1>{charge.title}</h1>

            <div className="card space-y-2">
                <div><b>Ingatlan:</b> {property?.name ?? "-"}</div>
                <div><b>Összeg:</b> {charge.amount} {charge.currency}</div>
                <div><b>Esedékes:</b> {charge.due_date}</div>
                <div>
                    <b>Státusz:</b>{" "}
                    <span className={`status-badge status-${String(charge.status).toLowerCase()}`}>
                        {charge.status}
                    </span>
                </div>
                {charge.status === "PAID" && charge.paid_at ? (
                    <div><b>Fizetve:</b> {new Date(charge.paid_at).toLocaleString("hu-HU")}</div>
                ) : null}
            </div>

            <div className="card space-y-2">
                <div className="card-title">Dokumentumok</div>
                {(documentsWithUrls ?? []).length === 0 ? (
                    <p className="text-sm text-gray-600">Nincs feltöltött dokumentum.</p>
                ) : (
                    <div className="text-sm text-gray-600 space-y-1">
                        {(documentsWithUrls ?? []).map((doc: any) => (
                            <div key={doc.id}>
                                <a className="link" href={doc.signed_url} target="_blank" rel="noreferrer">
                                    Dok: {doc.bucket_path.split("/").at(-1)}
                                </a>{" "}
                                • {new Date(doc.created_at).toLocaleString("hu-HU")}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
