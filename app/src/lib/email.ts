import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

let client: SESv2Client | undefined;

// AWS_* names are reserved on Vercel, hence the SES_* variables
export function isEmailConfigured() {
  return !!(
    process.env.SES_REGION &&
    process.env.SES_ACCESS_KEY_ID &&
    process.env.SES_SECRET_ACCESS_KEY
  );
}

function sesClient() {
  client ??= new SESv2Client({
    region: process.env.SES_REGION,
    credentials: {
      accessKeyId: process.env.SES_ACCESS_KEY_ID!,
      secretAccessKey: process.env.SES_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

// Single entry point for outgoing email (Amazon SES)
export async function sendEmail(input: EmailInput) {
  if (!isEmailConfigured()) {
    throw new Error("No email provider configured");
  }

  const from = input.from ?? process.env.AUTH_EMAIL_FROM;
  if (!from) throw new Error("AUTH_EMAIL_FROM is not set");

  const result = await sesClient().send(
    new SendEmailCommand({
      FromEmailAddress: from,
      Destination: { ToAddresses: [input.to] },
      ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
      ConfigurationSetName: process.env.SES_CONFIGURATION_SET || undefined,
      Content: {
        Simple: {
          Subject: { Data: input.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: input.html, Charset: "UTF-8" },
            ...(input.text ? { Text: { Data: input.text, Charset: "UTF-8" } } : {}),
          },
        },
      },
    }),
  );

  return { id: result.MessageId ?? null };
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
