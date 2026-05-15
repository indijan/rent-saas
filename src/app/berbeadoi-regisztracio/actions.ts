"use server";

import { redirect } from "next/navigation";
import { sendEmail } from "@/lib/email/resend";
import { renderOwnerLeadEmail } from "@/lib/email/templates";

export async function submitOwnerRegistration(formData: FormData) {
    const fullName = String(formData.get("full_name") || "").trim();
    const companyName = String(formData.get("company_name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim();
    const billingAddress = String(formData.get("billing_address") || "").trim();

    if (!fullName || !email || !phone || !billingAddress) {
        redirect("/berbeadoi-regisztracio?status=error&message=Az+összes+kötelező+mezőt+ki+kell+tölteni.");
    }

    const emailRes = await sendEmail(renderOwnerLeadEmail({
        ownerEmail: process.env.OWNER_REGISTRATION_TO || "indijanmac@gmail.com",
        fullName,
        companyName: companyName || null,
        email,
        phone,
        billingAddress,
    }));

    if (!emailRes.ok) {
        redirect(`/berbeadoi-regisztracio?status=error&message=${encodeURIComponent(emailRes.error)}`);
    }

    redirect("/berbeadoi-regisztracio?status=success&message=Az+ig%C3%A9nyed+meg%C3%A9rkezett%2C+r%C3%B6videsen+felvessz%C3%BCk+veled+a+kapcsolatot.");
}
