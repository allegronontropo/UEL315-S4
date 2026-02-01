import express from "express";
import { connectDb } from "./db.js";
import documentsRoutes from "./routes/documents.js";
import statsRoutes from "./routes/stats.js";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.get("/", (req, res) => res.redirect("/documents"));
app.use("/documents", documentsRoutes);
app.use("/stats", statsRoutes);


const PORT = process.env.PORT || 3000;

async function start() {
  await connectDb();
  app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
}

start().catch((err) => {
  console.error("Erreur démarrage:", err);
  process.exit(1);
});
