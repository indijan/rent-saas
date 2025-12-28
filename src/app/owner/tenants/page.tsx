import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createTenant } from "./actions";

export default async function OwnerTenantsPage() {
    await requireRole("OWNER");
    const admin = createSupabaseAdminClient();

    const { data: tenants, error } = await admin
        .from("profiles")
        .select("id,email,full_name,created_at")
        .eq("role", "TENANT")
        .order("created_at", { ascending: false });

    async function onCreate(formData: FormData) {
        "use server";
        const res = await createTenant(formData);
        if (!res.ok) return;
        revalidatePath("/owner/tenants");
    }

    if (error) {
        return (
            <main className="app-shell page-enter">
                <div className="card space-y-2">
                    <h1>Bérlők</h1>
                    <p className="mt-2 text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="app-shell page-enter space-y-4">
            <div className="card flex items-center justify-between">
                <h1>Bérlők</h1>
                <div className="flex gap-4">
                    <Link className="link" href="/owner/properties">Ingatlanok</Link>
                    <Link className="link" href="/account">Account</Link>
                </div>
            </div>

            <form action={onCreate} className="card space-y-3">
                <div className="card-title">Új bérlő létrehozása</div>
                <div className="grid gap-3 md:grid-cols-2">
                    <input
                        name="full_name"
                        placeholder="Név"
                        className="input"
                        required
                    />
                    <input
                        name="email"
                        type="email"
                        placeholder="Email"
                        className="input"
                        required
                    />
                </div>
                <button className="btn btn-primary">
                    Meghívás
                </button>
                <p className="text-xs text-gray-600">
                    A bérlő emailben kap meghívót, és saját jelszót állít be.
                </p>
            </form>

            {(!tenants || tenants.length === 0) ? (
                <div className="card">
                    <p className="card-title">Még nincs bérlő.</p>
                </div>
            ) : (
                <div className="card divide-y">
                    {tenants.map((tenant) => (
                        <div key={tenant.id} className="p-4">
                            <div className="card-title">{tenant.full_name || "Név nélküli"}</div>
                            <div className="text-sm text-gray-600">{tenant.email}</div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
