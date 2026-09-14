export function isWhatsAppConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  );
}

type WhatsAppInput = {
  to: string; // E.164
  body: string;
  templateVariables: Record<string, string>;
};

// With an approved content template (required outside the 24h customer window)
// Twilio sends the template and ignores `body`.
export async function sendWhatsApp({ to, body, templateVariables }: WhatsAppInput) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID_FOLLOWUP;

  const params = new URLSearchParams({
    From: process.env.TWILIO_WHATSAPP_FROM!,
    To: `whatsapp:${to}`,
  });
  if (templateSid) {
    params.set("ContentSid", templateSid);
    params.set("ContentVariables", JSON.stringify(templateVariables));
  } else {
    params.set("Body", body);
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });

  const data = (await response.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!response.ok) {
    throw new Error(`Twilio ${response.status}: ${data.message ?? "unknown error"}`);
  }
  return { id: data.sid ?? null };
}
