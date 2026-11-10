import { getStore } from "@netlify/blobs";

const siteID = process.env.NETLIFY_SITE_ID;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!token || !siteID) {
  console.error("NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID required");
  process.exit(1);
}

const store = getStore({ name: "doroga-msk-reports", siteID, token });
const raw = await store.get("all", { type: "json" });
const reports = Array.isArray(raw) ? raw : [];
let moved = 0;
const slim = [];
for (const report of reports) {
  if (report?.photoDataUrl) {
    await store.set(`photo:${report.id}`, report.photoDataUrl);
    const { photoDataUrl, ...rest } = report;
    slim.push({ ...rest, hasPhoto: true });
    moved += 1;
  } else {
    slim.push(report);
  }
}
await store.setJSON("all", slim);
const bytes = Buffer.byteLength(JSON.stringify(slim));
console.log(`reports=${slim.length} photosMoved=${moved} listBytes=${bytes}`);
