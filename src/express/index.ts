import express from "express";
import cors from "cors";

import playeraddresses from "./playeraddresses";

const PORT = process.env.PORT ?? 3000;

const app = express();

app.use(cors({
    origin: [
        `http://localhost:5173`,
        "https://www.kromer.club",
        "https://krawlet.kromer.club",
    ],
    methods: ["GET", "POST"],
    credentials: true,
}));

app.use("/playeraddresses", playeraddresses);

app.listen(PORT, () => {
    console.log(`Express server listening on port ${PORT}`);
});
