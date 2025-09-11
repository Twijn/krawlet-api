import {Router} from "express";
import {getKnownAddresses} from "../../lib/models";

const router = Router();

router.get("/", (req, res) => {
    res.json({
        ok: true,
        data: getKnownAddresses(),
    });
});

export default router;
