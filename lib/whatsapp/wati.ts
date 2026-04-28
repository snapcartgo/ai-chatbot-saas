import type { Payload } from "./index";

export async function sendViaWati(payload: Payload) {
  console.log("WATI", payload);
  return { success: true };
}