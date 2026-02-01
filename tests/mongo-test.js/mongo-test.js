
import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;     
const dbName = process.env.DB_NAME;    

async function main() {
  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db(dbName);
  const col = db.collection("documents");

  const docs = await col
    .find({}, { projection: { "fields.titre_avec_lien_vers_le_catalogue": 1 } })
    .limit(5)
    .toArray();

  console.log(docs);

  await client.close();
}

main().catch(console.error);
