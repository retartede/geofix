import { getStore } from "@netlify/blobs";

const siteID = process.env.NETLIFY_SITE_ID || "d7050306-e5d3-4072-9a73-d71e11dedf12";
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!token) {
  console.error("NETLIFY_AUTH_TOKEN required");
  process.exit(1);
}

const store = getStore({ name: "doroga-msk-reports", siteID, token });
await store.setJSON("all", []);
const check = await store.get("all", { type: "json" });
console.log("cleared, count:", Array.isArray(check) ? check.length : check);
