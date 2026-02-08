import { Router, json } from 'express';
import { authenticateApiKeyTier } from '../../../lib/authenticateApiKeyTier';
import { ShopSyncData, validateShopSyncData } from '../../../lib/shopSyncValidate';
import {
  updateShop,
  getShop,
  getShops,
  getListingsByShopId,
  ShopSourceType,
  shouldIgnoreModemShopSyncUpdate,
} from '../../../lib/models';
import {
  recordValidationFailure,
  recordSuccessfulPost,
  detectAndRecordShopChanges,
  detectAndRecordItemChanges,
} from '../../shopsync/reporter';

const router = Router();

// GET /v1/shops - Get all shops
router.get('/', async (req, res) => {
  try {
    const shops = await getShops();
    return res.success(shops.map((s) => s.raw()));
  } catch (error) {
    console.error('Error fetching shops:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch shops', 500);
  }
});

// GET /v1/shops/:id - Get shop by ID
router.get('/:id', async (req, res) => {
  try {
    const shop = await getShop(req.params.id);
    if (shop) {
      return res.success(shop.raw());
    } else {
      return res.error('SHOP_NOT_FOUND', `Shop with ID ${req.params.id} not found`, 404);
    }
  } catch (error) {
    console.error('Error fetching shop:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch shop', 500);
  }
});

// GET /v1/shops/:id/items - Get items for a shop
router.get('/:id/items', async (req, res) => {
  try {
    const items = await getListingsByShopId(req.params.id);
    return res.success(items.map((item) => item.raw()));
  } catch (error) {
    console.error('Error fetching shop items:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch shop items', 500);
  }
});

// POST /v1/shops - Create/update shop (authenticated - shopsync or internal tier keys only)
router.post('/', authenticateApiKeyTier('shopsync', 'internal'), json(), async (req, res) => {
  try {
    const validation = validateShopSyncData(req.body);

    if (!validation.isValid) {
      console.error(`Received invalid response (shop ${req.body?.info?.name})`);
      console.error(validation.errors);

      // Record validation failure
      recordValidationFailure(req.body, validation.errors);

      return res.error('VALIDATION_ERROR', 'Invalid ShopSync data', 400, validation.errors);
    }

    // Data is valid
    const shopSyncData: ShopSyncData = req.body;

    // Extract sourceType from request body (optional, defaults to modem)
    const sourceType: ShopSourceType | undefined =
      req.body.sourceType === 'radio_tower' ? 'radio_tower' : 'modem';

    const shouldIgnoreModemUpdate =
      sourceType === 'modem' && (await shouldIgnoreModemShopSyncUpdate(shopSyncData));

    if (shouldIgnoreModemUpdate) {
      recordSuccessfulPost(shopSyncData);
      console.log(
        'Ignored modem ShopSync update for ' +
          shopSyncData.info.name +
          ' due to recent radio tower update',
      );

      return res.success({
        message: 'Shop update skipped due to recent radio tower update',
        skipped: true,
        reason: 'recent_radio_tower_update',
      });
    }

    // Detect changes before updating (for reporting)
    await detectAndRecordShopChanges(shopSyncData);
    await detectAndRecordItemChanges(shopSyncData);

    await updateShop(shopSyncData, sourceType);

    // Record successful POST
    recordSuccessfulPost(shopSyncData);

    return res.success({ message: 'Shop updated successfully' }, 201);
  } catch (error) {
    console.error('Error updating shop:', error);
    return res.error('INTERNAL_ERROR', 'Failed to update shop', 500);
  }
});

export default router;
