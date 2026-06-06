export const CHARGE_TYPES = ["RENT", "UTILITY", "INSURANCE", "COMMON_COST", "RENOVATION", "TAX", "OTHER"] as const;

export type ChargeType = (typeof CHARGE_TYPES)[number];

export const ALL_CHARGE_TYPE_OPTIONS: ReadonlyArray<{ value: ChargeType; label: string }> = [
    { value: "RENT", label: "Bérleti díj" },
    { value: "UTILITY", label: "Rezsi" },
    { value: "INSURANCE", label: "Biztosítás" },
    { value: "COMMON_COST", label: "Közös költség" },
    { value: "RENOVATION", label: "Felújítás" },
    { value: "TAX", label: "Adó" },
    { value: "OTHER", label: "Egyéb" },
];

export const FORWARDED_CHARGE_TYPE_OPTIONS = ALL_CHARGE_TYPE_OPTIONS.filter((option) => option.value !== "TAX");

export const OWN_EXPENSE_CHARGE_TYPE_OPTIONS = ALL_CHARGE_TYPE_OPTIONS.filter((option) => option.value !== "RENT");

export const EXPENSE_CATEGORY_CONFIG: ReadonlyArray<{ label: string; color: string; type: ChargeType | "OTHER_EXPENSES" }> = [
    { label: "Rezsi", color: "#1D73FF", type: "UTILITY" },
    { label: "Közös költség", color: "#FF9C1A", type: "COMMON_COST" },
    { label: "Biztosítás", color: "#10C5E9", type: "INSURANCE" },
    { label: "Adó", color: "#FF5C5C", type: "TAX" },
    { label: "Egyéb költség", color: "#7635FF", type: "OTHER" },
    { label: "Felújítás", color: "#18C24A", type: "RENOVATION" },
    { label: "Egyéb", color: "#A9B7D0", type: "OTHER_EXPENSES" },
];

export function isOwnOnlyChargeType(type: string) {
    return type === "TAX";
}

export function isOwnExpenseRestrictedChargeType(type: string) {
    return type === "RENT";
}

export function getChargeTypeLabel(type: string, tenantId?: string | null) {
    if (!tenantId && type === "OTHER") return "Egyéb költség";
    switch (type) {
        case "RENT":
            return "Bérleti díj";
        case "UTILITY":
            return "Rezsi";
        case "INSURANCE":
            return "Biztosítás";
        case "COMMON_COST":
            return "Közös költség";
        case "RENOVATION":
            return "Felújítás";
        case "TAX":
            return "Adó";
        default:
            return "Egyéb";
    }
}
