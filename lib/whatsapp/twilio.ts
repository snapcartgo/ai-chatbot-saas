import type { Payload } from "./index";

export async function sendViaTwilio(payload: Payload) {
  console.log("Twilio", payload);
  return { success: true };
}