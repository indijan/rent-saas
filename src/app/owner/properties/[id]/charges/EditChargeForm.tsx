import { updateCharge } from "./actions";

type Props = {
    charge: {
        id: string;
        title: string;
        type: string;
        amount: number | string;
        currency: string | null;
        due_date: string;
    };
};

export default function EditChargeForm({ charge }: Props) {
    return (
        <details className="w-full rounded-xl border border-black/10 bg-white/60 p-3">
            <summary className="btn btn-secondary btn-sm cursor-pointer">
                Tétel szerkesztése
            </summary>
            <form
                action={async (formData) => {
                    "use server";
                    await updateCharge(charge.id, formData);
                }}
                className="mt-3 grid gap-2 md:grid-cols-2"
            >
                <input
                    name="title"
                    defaultValue={charge.title}
                    className="input"
                    required
                />
                <select
                    name="type"
                    defaultValue={charge.type}
                    className="select"
                >
                    <option value="RENT">Bérleti díj</option>
                    <option value="UTILITY">Rezsi</option>
                    <option value="COMMON_COST">Közös költség</option>
                    <option value="OTHER">Egyéb</option>
                </select>
                <input
                    name="amount"
                    defaultValue={String(charge.amount)}
                    className="input"
                    type="text"
                    required
                />
                <input
                    name="due_date"
                    defaultValue={charge.due_date}
                    className="input"
                    type="date"
                    required
                />
                <input
                    name="currency"
                    defaultValue={charge.currency || "HUF"}
                    className="input"
                />
                <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                >
                    Mentés státuszmódosítás nélkül
                </button>
                <div className="muted-note">A mentés csak a mezőket frissíti, a státuszt nem.</div>
            </form>
        </details>
    );
}
