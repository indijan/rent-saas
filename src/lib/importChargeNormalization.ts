import { CHARGE_TYPES, type ChargeType, isOwnExpenseRestrictedChargeType, isOwnOnlyChargeType } from "@/lib/chargeTypes";
import type { ImportMode } from "@/lib/importModes";

function toChargeType(value: string): ChargeType {
    return CHARGE_TYPES.includes(value as ChargeType) ? (value as ChargeType) : "OTHER";
}

export function normalizeImportedChargeMode(importMode: ImportMode, chargeType: string) {
    let effectiveImportMode = importMode;
    let effectiveChargeType = toChargeType(chargeType);

    if (effectiveImportMode === "FORWARDED" && isOwnOnlyChargeType(effectiveChargeType)) {
        effectiveImportMode = "OWN_EXPENSE";
    }
    if (effectiveImportMode === "OWN_EXPENSE" && isOwnExpenseRestrictedChargeType(effectiveChargeType)) {
        effectiveChargeType = "OTHER";
    }

    return {
        importMode: effectiveImportMode,
        chargeType: effectiveChargeType,
    };
}
