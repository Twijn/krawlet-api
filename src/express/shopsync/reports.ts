/**
 * ShopSync Reports API - GET endpoints for retrieving ShopSync reporting data
 *
 * Each endpoint returns both in-memory (recent) and persistent (history) data.
 * Use source=memory for in-memory only, source=persistent for database only.
 */

import { Router } from 'express';
import {
  getValidationFailures,
  getSuccessfulPosts,
  getShopChanges,
  getItemChanges,
  getReporterStats,
  getRecordById,
  getShopChangeLogs,
  getItemChangeLogs,
  getPriceChangeLogs,
} from './reporter';

const router = Router();

/**
 * GET /reports/stats
 * Get overall statistics about recorded data
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getReporterStats();
    res.json({
      ok: true,
      data: stats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /reports/validation-failures
 * Get validation failure records
 * Query params:
 *   - limit: number (optional) - max records to return
 */
router.get('/validation-failures', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const records = getValidationFailures(limit);
    res.json({
      ok: true,
      count: records.length,
      data: records,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /reports/successful-posts
 * Get successful POST records
 * Query params:
 *   - limit: number (optional) - max records to return
 */
router.get('/successful-posts', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const records = getSuccessfulPosts(limit);
    res.json({
      ok: true,
      count: records.length,
      data: records,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /reports/shop-changes
 * Get shop change records (in-memory recent + persistent history)
 * Query params:
 *   - limit: number (optional) - max records to return
 *   - offset: number (optional) - pagination offset (persistent only)
 *   - shopId: string (optional) - filter by shop ID
 *   - since: string (optional) - ISO date for start of range (persistent only)
 *   - until: string (optional) - ISO date for end of range (persistent only)
 *   - source: 'memory' | 'persistent' | 'both' (optional, default: 'both')
 */
router.get('/shop-changes', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const shopId = req.query.shopId as string | undefined;
    const source = (req.query.source as string) || 'both';

    const result: any = { ok: true };

    if (source === 'memory' || source === 'both') {
      const recent = getShopChanges(limit, shopId);
      result.recent = recent;
      result.recentCount = recent.length;
    }

    if (source === 'persistent' || source === 'both') {
      const options: any = { limit, shopId };
      if (req.query.offset) options.offset = parseInt(req.query.offset as string, 10);
      if (req.query.since) options.since = new Date(req.query.since as string);
      if (req.query.until) options.until = new Date(req.query.until as string);

      const history = await getShopChangeLogs(options);
      result.history = history;
      result.historyCount = history.length;
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /reports/item-changes
 * Get item change records (in-memory recent + persistent history)
 * Query params:
 *   - limit: number (optional) - max records to return
 *   - offset: number (optional) - pagination offset (persistent only)
 *   - shopId: string (optional) - filter by shop ID
 *   - changeType: 'added' | 'removed' (optional) - filter by change type (persistent only)
 *   - since: string (optional) - ISO date for start of range (persistent only)
 *   - until: string (optional) - ISO date for end of range (persistent only)
 *   - source: 'memory' | 'persistent' | 'both' (optional, default: 'both')
 */
router.get('/item-changes', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const shopId = req.query.shopId as string | undefined;
    const source = (req.query.source as string) || 'both';

    const result: any = { ok: true };

    if (source === 'memory' || source === 'both') {
      const recent = getItemChanges(limit, shopId);
      result.recent = recent;
      result.recentCount = recent.length;
    }

    if (source === 'persistent' || source === 'both') {
      const options: any = { limit, shopId };
      if (req.query.offset) options.offset = parseInt(req.query.offset as string, 10);
      if (req.query.changeType) options.changeType = req.query.changeType as 'added' | 'removed';
      if (req.query.since) options.since = new Date(req.query.since as string);
      if (req.query.until) options.until = new Date(req.query.until as string);

      const history = await getItemChangeLogs(options);
      result.history = history;
      result.historyCount = history.length;
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /reports/price-changes
 * Get price/property change records (persistent only - no in-memory cache)
 * Query params:
 *   - limit: number (optional) - max records to return
 *   - offset: number (optional) - pagination offset
 *   - shopId: string (optional) - filter by shop ID
 *   - itemHash: string (optional) - filter by item hash
 *   - since: string (optional) - ISO date for start of range
 *   - until: string (optional) - ISO date for end of range
 */
router.get('/price-changes', async (req, res) => {
  try {
    const options: any = {};
    if (req.query.limit) options.limit = parseInt(req.query.limit as string, 10);
    if (req.query.offset) options.offset = parseInt(req.query.offset as string, 10);
    if (req.query.shopId) options.shopId = req.query.shopId as string;
    if (req.query.itemHash) options.itemHash = req.query.itemHash as string;
    if (req.query.since) options.since = new Date(req.query.since as string);
    if (req.query.until) options.until = new Date(req.query.until as string);

    const { rows, total } = await getPriceChangeLogs(options);
    res.json({
      ok: true,
      count: rows.length,
      total,
      data: rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /reports/record/:id
 * Get a specific record by ID (from any category)
 */
router.get('/record/:id', (req, res) => {
  try {
    const record = getRecordById(req.params.id);
    if (record) {
      res.json({
        ok: true,
        data: record,
      });
    } else {
      res.status(404).json({
        ok: false,
        error: 'Record not found',
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

/**
 * GET /reports/all
 * Get all records from all categories (useful for debugging)
 * Query params:
 *   - limit: number (optional) - max records per category
 */
router.get('/all', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    res.json({
      ok: true,
      data: {
        stats: await getReporterStats(),
        validationFailures: getValidationFailures(limit),
        successfulPosts: getSuccessfulPosts(limit),
        shopChanges: getShopChanges(limit),
        itemChanges: getItemChanges(limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

export default router;
