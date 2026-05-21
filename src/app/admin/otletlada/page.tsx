import { requireRole } from "@/lib/auth/requireRole";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import AppHeader from "@/components/AppHeader";

type IdeaRow = {
    id: string;
    email: string;
    full_name: string | null;
    role_context: string;
    source: string;
    feature_name: string;
    description: string;
    status: string;
    page_context: string | null;
    created_at: string;
};

export default async function AdminIdeaBoxPage() {
    const { profile } = await requireRole("ADMIN");
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
        .from("idea_submissions")
        .select("id,email,full_name,role_context,source,feature_name,description,status,page_context,created_at")
        .order("created_at", { ascending: false });

    if (error) {
        return (
            <main className="app-shell page-enter">
                <AppHeader profile={profile} />
                <div className="card">
                    <h1>Ötletláda</h1>
                    <p className="text-red-600">Hiba: {error.message}</p>
                </div>
            </main>
        );
    }

    const grouped = new Map<string, IdeaRow[]>();
    ((data ?? []) as IdeaRow[]).forEach((idea) => {
        const current = grouped.get(idea.email) ?? [];
        current.push(idea);
        grouped.set(idea.email, current);
    });

    return (
        <main className="app-shell page-enter space-y-4">
            <AppHeader profile={profile} />

            <section className="card section-stack">
                <div>
                    <div className="eyebrow">Admin</div>
                    <h1>Ötletláda</h1>
                    <p>Itt látod, ki milyen funkcióötletet, visszajelzést vagy problémát küldött be email címhez kötve.</p>
                </div>
            </section>

            <section className="charge-list">
                {grouped.size === 0 ? (
                    <div className="card">
                        <div className="card-title">Még nincs beküldött ötlet.</div>
                    </div>
                ) : (
                    Array.from(grouped.entries()).map(([email, ideas]) => (
                        <article key={email} className="card section-stack">
                            <div className="section-header">
                                <div>
                                    <div className="card-title">{ideas[0]?.full_name || "Név nélkül"}</div>
                                    <div className="charge-meta">
                                        <span>{email}</span>
                                        <span>{ideas.length} beküldés</span>
                                    </div>
                                </div>
                            </div>
                            <div className="charge-list">
                                {ideas.map((idea) => (
                                    <article key={idea.id} className="charge-card">
                                        <div className="card-title">{idea.feature_name}</div>
                                        <div className="charge-meta">
                                            <span>Szerepkör: {idea.role_context}</span>
                                            <span>Forrás: {idea.source === "SIGNED_IN" ? "Belépett" : "Publikus"}</span>
                                            <span>Oldal: {idea.page_context || "-"}</span>
                                            <span>{new Date(idea.created_at).toLocaleString("hu-HU")}</span>
                                        </div>
                                        <p>{idea.description}</p>
                                    </article>
                                ))}
                            </div>
                        </article>
                    ))
                )}
            </section>
        </main>
    );
}
