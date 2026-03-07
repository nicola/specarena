import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { up, down } from "./migrations";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const db = new Kysely<any>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({ connectionString }),
  }),
});

const command = process.argv[2] ?? "up";

async function run() {
  if (command === "up") {
    console.log("Running migrations (up)...");
    await up(db);
    console.log("Done.");
  } else if (command === "down") {
    console.log("Running migrations (down)...");
    await down(db);
    console.log("Done.");
  } else {
    console.error(`Unknown command: ${command}. Use "up" or "down".`);
    process.exit(1);
  }
  await db.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
