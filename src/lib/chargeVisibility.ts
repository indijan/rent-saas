export type ChargeVisibilityInput = {
    tenant_id: string | null;
    type: string | null;
};

export function isOwnerExpenseCharge(charge: ChargeVisibilityInput) {
    return !charge.tenant_id && charge.type !== "RENT";
}

export function isTenantFacingCharge(charge: ChargeVisibilityInput) {
    return !isOwnerExpenseCharge(charge);
}
