import { updateEmailDeliveryStatusByMessageId, type EmailLogStatus } from "@/lib/emailLogs";

type SesMailPayload = {
    timestamp?: string;
    messageId?: string;
};

type SesEventPayload = {
    eventType?: string;
    notificationType?: string;
    mail?: SesMailPayload;
    bounce?: {
        bounceType?: string;
        bounceSubType?: string;
        diagnosticCode?: string;
    };
    complaint?: {
        complaintFeedbackType?: string;
    };
    reject?: {
        reason?: string;
    };
    failure?: {
        errorMessage?: string;
    };
    deliveryDelay?: {
        delayType?: string;
        expirationTime?: string;
    };
};

type EventBridgeEnvelope = {
    time?: string;
    detail?: SesEventPayload;
};

type SnsEnvelope = {
    Type?: string;
    Message?: string;
    SubscribeURL?: string;
};

function mapEventTypeToStatus(eventType: string | undefined): EmailLogStatus | null {
    switch ((eventType || "").trim().toLowerCase()) {
        case "send":
            return "ACCEPTED";
        case "delivery":
            return "DELIVERED";
        case "deliverydelay":
        case "delivery delay":
            return "DELIVERY_DELAY";
        case "bounce":
            return "BOUNCED";
        case "complaint":
            return "COMPLAINED";
        case "reject":
            return "REJECTED";
        case "renderingfailure":
        case "rendering failure":
            return "FAILED";
        default:
            return null;
    }
}

function describeEventError(event: SesEventPayload) {
    const eventType = (event.eventType || event.notificationType || "").trim();

    if (/bounce/i.test(eventType)) {
        return [event.bounce?.bounceType, event.bounce?.bounceSubType, event.bounce?.diagnosticCode].filter(Boolean).join(" · ") || "Bounce";
    }
    if (/complaint/i.test(eventType)) {
        return event.complaint?.complaintFeedbackType || "Spam panasz";
    }
    if (/reject/i.test(eventType)) {
        return event.reject?.reason || "SES elutasítás";
    }
    if (/rendering/i.test(eventType)) {
        return event.failure?.errorMessage || "Template render hiba";
    }
    if (/delivery\s*delay|deliverydelay/i.test(eventType)) {
        return [event.deliveryDelay?.delayType, event.deliveryDelay?.expirationTime].filter(Boolean).join(" · ") || "Kézbesítési késés";
    }

    return null;
}

function extractSesEvent(body: unknown) {
    if (!body || typeof body !== "object") return null;

    const maybeEventBridge = body as EventBridgeEnvelope;
    if (maybeEventBridge.detail?.mail?.messageId) {
        return {
            event: maybeEventBridge.detail,
            eventAt: maybeEventBridge.time || maybeEventBridge.detail.mail?.timestamp || new Date().toISOString(),
        };
    }

    const maybeSns = body as SnsEnvelope;
    if (maybeSns.Type === "SubscriptionConfirmation") {
        return { subscriptionConfirmation: true as const };
    }

    if (typeof maybeSns.Message === "string") {
        try {
            const nested = JSON.parse(maybeSns.Message) as SesEventPayload;
            if (nested.mail?.messageId) {
                return {
                    event: nested,
                    eventAt: nested.mail?.timestamp || new Date().toISOString(),
                };
            }
        } catch {
            return null;
        }
    }

    const direct = body as SesEventPayload;
    if (direct.mail?.messageId) {
        return {
            event: direct,
            eventAt: direct.mail.timestamp || new Date().toISOString(),
        };
    }

    return null;
}

export async function POST(request: Request) {
    const secret = process.env.EMAIL_DELIVERY_WEBHOOK_SECRET;
    const auth = request.headers.get("authorization");

    if (!secret || auth !== `Bearer ${secret}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const extracted = extractSesEvent(body);

    if (!extracted) {
        return Response.json({ ok: false, message: "Ismeretlen SES event payload." }, { status: 400 });
    }

    if ("subscriptionConfirmation" in extracted) {
        return Response.json({
            ok: true,
            message: "SNS subscription confirmation payload érkezett. Ehhez inkább EventBridge API Destination javasolt.",
        });
    }

    const messageId = extracted.event.mail?.messageId;
    const status = mapEventTypeToStatus(extracted.event.eventType || extracted.event.notificationType);

    if (!messageId || !status) {
        return Response.json({ ok: false, message: "A payloadból nem olvasható ki a MessageId vagy a státusz." }, { status: 400 });
    }

    await updateEmailDeliveryStatusByMessageId({
        providerMessageId: messageId,
        status,
        eventAt: extracted.eventAt,
        errorMessage: describeEventError(extracted.event),
    });

    return Response.json({ ok: true });
}
