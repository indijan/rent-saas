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
            className="card space-y-3"
        >
            <div className="card-title">Ingatlan törlése</div>
            <p className="text-sm text-gray-600">
                A törlés a kapcsolódó díjakat és dokumentumokat is eltávolítja.
            </p>
            <button className="btn btn-danger">
                Törlés
            </button>
        </form>
    );
}
