export const IMPORT_MODE_OPTIONS = [
    { value: "FORWARDED", label: "Továbbított költség" },
    { value: "OWN_EXPENSE", label: "Saját költség" },
] as const;

export type ImportMode = (typeof IMPORT_MODE_OPTIONS)[number]["value"];

export function getImportModeLabel(mode: string) {
    return IMPORT_MODE_OPTIONS.find((option) => option.value === mode)?.label || mode;
}
