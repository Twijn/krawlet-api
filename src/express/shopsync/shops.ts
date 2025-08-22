import { Router, json } from "express";
import authenticate from "../../lib/authenticate";
import {ShopSyncData, validateShopSyncData} from "../../lib/shopSyncValidate";
import {updateShop} from "../../lib/models";

const router = Router();

router.post("/",
    authenticate(process.env.SHOPSYNC_API_TOKEN ?? "123abc"),
    json(), async (req, res) => {
        try {
            const validation = validateShopSyncData(req.body);

            if (!validation.isValid) {
                return res.status(400).json({
                    ok: false,
                    error: "Invalid ShopSync data",
                    details: validation.errors
                });
            }

            // Data is valid
            const shopSyncData: ShopSyncData = req.body;

            await updateShop(shopSyncData);

            res.json({
                ok: true,
            });
        } catch(err) {
            res.status(500).json({
                ok: false,
                error: "Internal server error",
            });
            console.error(err);
        }
    }
);

export default router;
