import { Router } from "express";
import playerManager from "../../lib/managers/playerManager";
const router = Router();

router.get("/", (req, res) => {
    res.json({
        ok: true,
        data: playerManager.getAll(),
    });
});

export default router;
