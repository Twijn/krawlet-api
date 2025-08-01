import {Router} from "express";
import playerManager from "../../lib/managers/playerManager";

const router = Router();

router.get("/:names", (req, res) => {
    const names = req.params.names.split(",");
    return res.json({
        ok: true,
        data: playerManager.getPlayersFromNames(names),
    });
});

export default router;
