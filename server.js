import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";


const app = express();
const PORT = process.env.PORT || 3000;

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/?directConnection=true";
const DB_NAME = process.env.DB_NAME || "mediatheque";
const COLLECTION_NAME = process.env.COLLECTION_NAME || "documents";

let collection;


async function connectToMongo() {
  if (collection) {
    return collection;
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  collection = db.collection(COLLECTION_NAME);
  return collection;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


function normalizeText(value) {
  if (!value) {
    return "";
  }
  return String(value).trim();
}

function toBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value === "1";
  }
  return Boolean(value);
}

function formatDocument(raw) {
  return {
    id: raw._id?.toString() ?? "",
    title:
      normalizeText(raw.title) ||
      normalizeText(raw.TITRE) ||
      normalizeText(raw.FIELD1) ||
      "Titre inconnu",
    author:
      normalizeText(raw.author) ||
      normalizeText(raw.AUTEUR) ||
      normalizeText(raw.FIELD2) ||
      "Auteur inconnu",
    type:
      normalizeText(raw.type) ||
      normalizeText(raw.TYPE) ||
      normalizeText(raw.FIELD3) ||
      "Type inconnu",
    reservations:
      normalizeText(raw.reservations) ||
      normalizeText(raw.RESERVATIONS) ||
      normalizeText(raw.FIELD4) ||
      "0",
    rank:
      normalizeText(raw.rank) ||
      normalizeText(raw.RANG) ||
      normalizeText(raw.FIELD5) ||
      "-",
    available: !toBoolean(raw.FIELD9),
    rawId: raw._id,
  };
}

function buildFilters(query) {
  const filters = {};

  if (query.search) {
    const value = normalizeText(query.search);
    if (value) {
      filters.$or = [
        { title: { $regex: value, $options: "i" } },
        { author: { $regex: value, $options: "i" } },
        { TITRE: { $regex: value, $options: "i" } },
        { AUTEUR: { $regex: value, $options: "i" } },
        { FIELD1: { $regex: value, $options: "i" } },
        { FIELD2: { $regex: value, $options: "i" } },
      ];
    }
  }

  if (query.type && query.type !== "all") {
    filters.$or = filters.$or || [];
    const typeValue = normalizeText(query.type);
    if (typeValue) {
      filters.$or.push(
        { type: typeValue },
        { TYPE: typeValue },
        { FIELD3: typeValue }
      );
    }
  }

  if (query.status === "available") {
    filters.FIELD9 = { $ne: true };
  } else if (query.status === "borrowed") {
    filters.FIELD9 = true;
  }

  return filters;
}

function buildSort(sortKey) {
  if (sortKey === "title") {
    return { title: 1, TITRE: 1, FIELD1: 1 };
  }
  if (sortKey === "author") {
    return { author: 1, AUTEUR: 1, FIELD2: 1 };
  }
  if (sortKey === "type") {
    return { type: 1, TYPE: 1, FIELD3: 1 };
  }
  return { _id: 1 };
}

app.get("/", async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Number.parseInt(req.query.limit, 10) || 12;
  const filters = buildFilters(req.query);
  const sort = buildSort(req.query.sort);

  const coll = await connectToMongo();
  const total = await coll.countDocuments(filters);

  const cursor = coll
    .find(filters)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  const documents = await cursor.toArray();
  const formatted = documents.map(formatDocument);

  const totalBorrowed = await coll.countDocuments({ FIELD9: true });
  const totalAvailable = await coll.countDocuments({ FIELD9: { $ne: true } });

  res.render("index", {
    documents: formatted,
    page,
    total,
    limit,
    totalBorrowed,
    totalAvailable,
    query: {
      search: req.query.search || "",
      type: req.query.type || "all",
      status: req.query.status || "all",
      sort: req.query.sort || "default",
    },
  });
});

app.post("/documents/:id/toggle", async (req, res) => {
  const { id } = req.params;
  const coll = await connectToMongo();

  const doc = await coll.findOne({ _id: new ObjectId(id) });
  const borrowed = Boolean(doc?.FIELD9);

  await coll.updateOne(
    { _id: new ObjectId(id) },
    { $set: { FIELD9: !borrowed } }
  );

  res.redirect("back");
});

app.get("/stats", async (req, res) => {
  const coll = await connectToMongo();

  const total = await coll.countDocuments();
  const borrowed = await coll.countDocuments({ FIELD9: true });
  const available = await coll.countDocuments({ FIELD9: { $ne: true } });

  const types = await coll
    .aggregate([
      {
        $group: {
          _id: {
            $ifNull: ["$type", { $ifNull: ["$TYPE", "$FIELD3"] }],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])
    .toArray();

  res.render("stats", {
    total,
    borrowed,
    available,
    types,
  });
});

app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
