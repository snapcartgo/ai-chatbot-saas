import type { Payload } from "./index";

export async function sendViaGupshup(payload: Payload) {
  console.log("Gupshup", payload);
  return { success: true };
}
