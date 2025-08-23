import {Router} from "express";
import {getListings} from "../../lib/models";

const router = Router();

router.get("/", async (req, res) => {
    try {
        res.json({
            ok: true,
            data: await getListings()
        })
    } catch(err) {
        console.error(err);
        res.status(500).json({
            ok: false,
            error: "Internal server error",
        });
    }
})

export default router;
