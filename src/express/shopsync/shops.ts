import { Router, json } from 'express';
import authenticate from '../../lib/authenticate';
import { ShopSyncData, validateShopSyncData } from '../../lib/shopSyncValidate';
import { updateShop, getShop, getShops, getListingsByShopId } from '../../lib/models';
import {
  recordValidationFailure,
  recordSuccessfulPost,
  detectAndRecordShopChanges,
  detectAndRecordItemChanges,
} from './reporter';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const shop = await getShops();
    res.json({
      ok: true,
      data: shop.map((s) => s.raw()),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const shop = await getShop(req.params.id);
    if (shop) {
      res.json({
        ok: true,
        data: shop.raw(),
      });
    } else {
      res.status(404).json({
        ok: false,
        error: 'Shop not found',
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

router.get('/:id/items', async (req, res) => {
  try {
    res.json({
      ok: true,
      data: await getListingsByShopId(req.params.id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

router.post(
  '/',
  authenticate(process.env.SHOPSYNC_API_TOKEN ?? '123abc'),
  json(),
  async (req, res) => {
    try {
      const validation = validateShopSyncData(req.body);

      if (!validation.isValid) {
        console.error(`Received invalid response (shop ${req.body?.info?.name})`);
        console.error(validation.errors);

        // Record validation failure
        recordValidationFailure(req.body, validation.errors);

        return res.status(400).json({
          ok: false,
          error: 'Invalid ShopSync data',
          details: validation.errors,
        });
      }

      // Data is valid
      const shopSyncData: ShopSyncData = req.body;

      // Detect changes before updating (for reporting)
      await detectAndRecordShopChanges(shopSyncData);
      await detectAndRecordItemChanges(shopSyncData);

      await updateShop(shopSyncData);

      // Record successful POST
      recordSuccessfulPost(shopSyncData);

      console.log('Updated shop ' + shopSyncData.info.name);

      res.json({
        ok: true,
      });
    } catch (err) {
      console.error(err);
      let data = req.body;
      try {
        data = JSON.parse(data);
      } catch (e) {
        console.error(e);
      }
      console.error(data);
      res.status(500).json({
        ok: false,
        error: 'Internal server error',
      });
    }
  },
);

export default router;
