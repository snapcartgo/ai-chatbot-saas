import type { Payload } from "./index";

export async function sendViaMeta(payload: Payload) {
  console.log("Meta", payload);
  return { success: true };
}