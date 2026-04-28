import { sendViaWati } from "./wati";
import { sendViaGupshup } from "./gupshup";
import { sendViaMeta } from "./meta";
import { sendViaTwilio } from "./twilio";

type Provider = "wati" | "gupshup" | "meta" | "twilio";

export type Payload = {
  to: string;
  message: string;
  config: any;
};

export async function sendWhatsAppMessage(
  provider: Provider,
  payload: Payload
) {
  switch (provider) {
    case "wati":
      return sendViaWati(payload);

    case "gupshup":
      return sendViaGupshup(payload);

    case "meta":
      return sendViaMeta(payload);

    case "twilio":
      return sendViaTwilio(payload);

    default:
      throw new Error("Invalid provider");
  }
}