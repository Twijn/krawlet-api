import { Router } from "express";
import items from "./items";
import shops from "./shops";

const router = Router();

router.use("/items", items)
router.use("/shops", shops)

export default router;
