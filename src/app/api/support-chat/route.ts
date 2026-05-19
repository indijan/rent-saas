import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { buildSupportContext, getSupportLinks } from "@/lib/supportKnowledge";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

function trimHistory(history: ChatMessage[]) {
    return history.slice(-8);
}

export async function POST(request: NextRequest) {
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json(
            { error: "Az ügyfélszolgálati asszisztens most nem elérhető." },
            { status: 503 }
        );
    }

    const body = await request.json().catch(() => null) as { messages?: ChatMessage[] } | null;
    const messages = Array.isArray(body?.messages) ? body!.messages : [];
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content?.trim();

    if (!latestUserMessage) {
        return NextResponse.json({ error: "Hiányzik a kérdés." }, { status: 400 });
    }

    const { context, fullKnowledge, links } = await buildSupportContext(latestUserMessage);
    const history = trimHistory(messages);
    const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "support_chat_response",
                schema: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                        answer: { type: "string" },
                        escalate: { type: "boolean" },
                    },
                    required: ["answer", "escalate"],
                },
            },
        },
        messages: [
            {
                role: "system",
                content:
                    `Te a Rentapp ügyfélszolgálati asszisztense vagy. Mindig magyarul válaszolj. ` +
                    `Csak a Rentappal, annak funkcióival, használatával, szerepköreivel, díjkezelésével, importjaival, értesítéseivel, jelszó-visszaállításával és fiókkezelésével kapcsolatban válaszolj. ` +
                    `Soha ne találj ki funkciót vagy szabályt. Ha a tudásbázis alapján nem tudsz biztos választ adni, ezt mondd ki röviden, és állítsd az escalate mezőt true-ra. ` +
                    `Ha a kérdés a jelszó-visszaállításról szól és a felhasználó a levelet a spam mappában találta, mondd el egyértelműen, hogy a feladót tegye a megbízható feladók közé és kérjen új jelszó-visszaállító levelet. ` +
                    `Az answer mező ne legyen túl hosszú, de legyen konkrét és használható.`
            },
            {
                role: "system",
                content:
                    `Teljes tudásbázis:\n${fullKnowledge}\n\n` +
                    `A mostani kérdéshez kiemelt releváns részek:\n${context}`
            },
            ...history.map((message) => ({
                role: message.role,
                content: message.content,
            })),
        ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as { answer?: string; escalate?: boolean };

    const answer = (parsed.answer || "Most nem tudtam biztos választ adni.").trim();
    const escalate = Boolean(parsed.escalate);
    const contactCta = escalate
        ? `\n\nHa közvetlen segítség kell, írj itt:\nWhatsApp: ${links.whatsapp}\nMessenger: ${links.messenger}`
        : "";

    return NextResponse.json({
        answer: `${answer}${contactCta}`,
        escalate,
        links,
    });
}

export function GET() {
    return NextResponse.json({
        ok: true,
        links: getSupportLinks(),
    });
}
