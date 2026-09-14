import { Resend } from "resend";

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY;
}

// Single entry point for outgoing email, so swapping the provider (SES later)
// only touches this file.
export async function sendEmail(input: EmailInput) {
  if (!isEmailConfigured()) {
    throw new Error("No email provider configured");
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: input.from ?? process.env.AUTH_EMAIL_FROM!,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });

  if (error) {
    throw new Error(`Email not sent: ${error.message}`);
  }
  return { id: data?.id ?? null };
}

export function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
