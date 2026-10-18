import { createSign, generateKeyPairSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hasWebhookToken, isSnsHostedUrl, snsStringToSign, verifySnsMessage, type SnsMessage } from "./sns";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();

function signed(message: Omit<SnsMessage, "Signature">, algorithm = "RSA-SHA256"): SnsMessage {
  const signer = createSign(algorithm);
  signer.update(snsStringToSign({ ...message, Signature: "" }));
  return { ...message, Signature: signer.sign(privateKey, "base64") };
}

const notification = {
  Type: "Notification" as const,
  MessageId: "m-1",
  TopicArn: "arn:aws:sns:eu-west-1:123:clozer-ses",
  Message: '{"eventType":"Delivery"}',
  Timestamp: "2026-10-18T10:00:00.000Z",
  SignatureVersion: "2" as const,
  SigningCertURL: "https://sns.eu-west-1.amazonaws.com/SimpleNotificationService-abc.pem",
};

describe("SNS messages", () => {
  it("accepts a message signed with the SNS certificate", async () => {
    expect(await verifySnsMessage(signed(notification), async () => publicPem)).toBe(true);
  });

  it("checks SHA1 signatures for SignatureVersion 1", async () => {
    const message = signed({ ...notification, SignatureVersion: "1" }, "RSA-SHA1");
    expect(await verifySnsMessage(message, async () => publicPem)).toBe(true);
  });

  it("rejects a message changed after signing", async () => {
    const message = { ...signed(notification), Message: '{"eventType":"Bounce"}' };
    expect(await verifySnsMessage(message, async () => publicPem)).toBe(false);
  });

  it("never fetches a certificate outside SNS", async () => {
    let fetched = false;
    const message = signed({ ...notification, SigningCertURL: "https://evil.example.com/cert.pem" });
    expect(
      await verifySnsMessage(message, async () => {
        fetched = true;
        return publicPem;
      }),
    ).toBe(false);
    expect(fetched).toBe(false);
  });

  it("only trusts https SNS hosts", () => {
    expect(isSnsHostedUrl("https://sns.us-east-1.amazonaws.com/x.pem")).toBe(true);
    expect(isSnsHostedUrl("http://sns.us-east-1.amazonaws.com/x.pem")).toBe(false);
    expect(isSnsHostedUrl("https://sns.us-east-1.amazonaws.com.evil.com/x.pem")).toBe(false);
    expect(isSnsHostedUrl("not a url")).toBe(false);
  });

  it("signs the subscription fields in the AWS order", () => {
    const text = snsStringToSign({
      ...notification,
      Type: "SubscriptionConfirmation",
      SubscribeURL: "https://sns.eu-west-1.amazonaws.com/?Action=ConfirmSubscription",
      Token: "tok",
      Signature: "",
    });
    expect(text.split("\n").filter((_, i) => i % 2 === 0).slice(0, 7)).toEqual([
      "Message",
      "MessageId",
      "SubscribeURL",
      "Timestamp",
      "Token",
      "TopicArn",
      "Type",
    ]);
  });

  it("wants the exact token in the URL", () => {
    const secret = "a-webhook-token-long-enough";
    expect(hasWebhookToken(new Request(`https://app.test/api/webhooks/ses?token=${secret}`), secret)).toBe(true);
    expect(hasWebhookToken(new Request("https://app.test/api/webhooks/ses?token=nope"), secret)).toBe(false);
    expect(hasWebhookToken(new Request(`https://app.test/api/webhooks/ses?token=${secret}`), undefined)).toBe(false);
  });
});
