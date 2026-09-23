import { MongoClient, type Db } from "mongodb";

let client: MongoClient | undefined;
let db: Db | undefined;

export function mongoDatabaseName(): string {
  return process.env.MONGODATABASE?.trim() || "gocentral";
}

export async function getMongo(): Promise<Db> {
  if (db) {
    return db;
  }

  const uri = process.env.MONGOCONNECTIONSTRING?.trim();
  if (!uri) {
    throw new Error(
      "MONGOCONNECTIONSTRING is not set. Copy .env.example to .env and set the Mongo connection string.",
    );
  }

  const name = mongoDatabaseName();
  console.log(`Connecting to MongoDB database ${name}...`);
  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS: 8_000,
  });
  await client.connect();
  db = client.db(name);
  console.log("Connected to MongoDB.");
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
