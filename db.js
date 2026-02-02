import { MongoClient } from "mongodb";

let client;
let db;

export async function connectDb() {
  if (db) return db;

  const uri = process.env.MONGO_URI;
  const dbName = process.env.DB_NAME;

  if (!uri) throw new Error("MONGO_URI manquant dans .env");
  if (!dbName) throw new Error("DB_NAME manquant dans .env");

  client = new MongoClient(uri);
  await client.connect();

  db = client.db(dbName);
  console.log(" Mongo connecté à :", dbName);

  return db;
}

export function getDb() {
  if (!db) throw new Error("DB non connectée. Appelle connectDb() d'abord.");
  return db;
}
