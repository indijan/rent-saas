"use client";

type Props = {
    action: (formData: FormData) => void | Promise<void>;
};

export default function DeleteTenantButton({ action }: Props) {
    return (
        <form
            action={action}
            onSubmit={(event) => {
                if (!window.confirm("Biztosan törlöd ezt a bérlőt?")) {
                    event.preventDefault();
                }
            }}
        >
            <button className="btn btn-secondary" type="submit">
                Törlés
            </button>
        </form>
    );
}
