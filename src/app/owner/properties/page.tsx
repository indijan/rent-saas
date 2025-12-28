import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import AppHeader from "@/components/AppHeader";
import { createProperty } from "./actions";

export default async function OwnerPropertiesPage() {
    const { supabase, profile } = await requireRole("OWNER");

    const { data: properties, error } = await supabase
        .from("properties")
        .select("id,name,address,status,created_at")
        .order("created_at", { ascending: false });

    async function onCreate(formData: FormData) {
        "use server";
        const res = await createProperty(formData);
        if (!res.ok) return;
        revalidatePath("/owner/properties");
    }

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card space-y-2">
                <h1>Ingatlanok</h1>
                <p className="mt-2 text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <div className="card">
                <h1>Ingatlanok</h1>
            </div>

            <form action={onCreate} className="card space-y-3">
                <div className="card-title">Új ingatlan</div>
                <div className="grid gap-3 md:grid-cols-2">
                    <input
                        name="name"
                        placeholder="Megnevezés (pl. Belvárosi lakás)"
                        className="input"
                        required
                    />
                    <input
                        name="address"
                        placeholder="Cím"
                        className="input"
                        required
                    />
                </div>
                <button className="btn btn-primary">
                    Létrehozás
                </button>
                <p className="text-xs text-gray-600">
                    (MVP: automatikusan ACTIVE státusszal jön létre.)
                </p>
            </form>

            {(!properties || properties.length === 0) ? (
                <div className="card">
                    <p className="card-title">Nincs még ingatlanod.</p>
                </div>
            ) : (
                <div className="card divide-y">
                    {properties.map((p) => (
                        <Link
                            key={p.id}
                            href={`/owner/properties/${p.id}`}
                            className="block p-4 hover:bg-gray-50"
                        >
                            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="card-title">{p.name}</div>
                                    <div className="text-sm text-gray-600">{p.address}</div>
                                </div>
                                <div className={`status-badge status-${String(p.status).toLowerCase()}`}>
                                    {p.status}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </main>
    );
}
