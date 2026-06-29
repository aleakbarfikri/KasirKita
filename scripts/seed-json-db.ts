import { resetDb } from "../lib/server/data-store";

const dbFile = resetDb();
console.log(`KasirKita local JSON database reset: ${dbFile}`);
console.log("Owner login: ownerkasirkita / Regina050322");
