"use client";

type Props = {
    action: () => Promise<void>;
};

export default function DeletePropertyForm({ action }: Props) {
    return (
        <form
            action={action}
            onSubmit={(event) => {
                if (!window.confirm("Biztosan törlöd az ingatlant és minden kapcsolódó adatot?")) {
                    event.preventDefault();
                }
            }}
            className="card dashboard-section-card form-shell property-danger-card"
        >
            <div className="card-title">Ingatlan törlése</div>
            <p className="muted-note">
                A törlés a kapcsolódó díjakat és dokumentumokat is eltávolítja.
            </p>
            <button className="btn btn-danger">
                Törlés
            </button>
        </form>
    );
}
