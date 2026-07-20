// One-off: existing holiday_packages docs predate the title_lower field.
// Run once so search covers packages saved before this fix, not just after.
import "dotenv/config";
import { getFirestore } from "../src/config/firebase";

async function main() {
  const db = getFirestore();
  const snap = await db.collection("holiday_packages").where("isGladex", "==", true).get();

  let updated = 0;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.title === "string" && !data.title_lower) {
      batch.update(doc.ref, { title_lower: data.title.toLowerCase() });
      opsInBatch++;
      updated++;
      if (opsInBatch >= 400) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
  }
  if (opsInBatch > 0) await batch.commit();
  console.log(`Backfilled title_lower on ${updated} package(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });