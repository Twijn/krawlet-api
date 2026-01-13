import { Router } from 'express';
import {
  getValidationFailures,
  getSuccessfulPosts,
  getShopChanges,
  getItemChanges,
  getReporterStats,
  getRecordById,
} from '../../shopsync/reporter';
import { getShopChangeLogs, getItemChangeLogs, getPriceChangeLogs } from '../../../lib/models';

const router = Router();

// GET /v1/reports/stats - Get overall statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await getReporterStats();
    return res.success(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch statistics', 500);
  }
});

// GET /v1/reports/validation-failures - Get validation failures
router.get('/validation-failures', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const records = getValidationFailures(limit);
    return res.success({
      count: records.length,
      records,
    });
  } catch (error) {
    console.error('Error fetching validation failures:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch validation failures', 500);
  }
});

// GET /v1/reports/successful-posts - Get successful posts
router.get('/successful-posts', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const records = getSuccessfulPosts(limit);
    return res.success({
      count: records.length,
      records,
    });
  } catch (error) {
    console.error('Error fetching successful posts:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch successful posts', 500);
  }
});

// GET /v1/reports/shop-changes - Get shop changes
router.get('/shop-changes', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const shopId = req.query.shopId as string | undefined;

    const records = getShopChanges(limit, shopId);
    return res.success({
      count: records.length,
      records,
    });
  } catch (error) {
    console.error('Error fetching shop changes:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch shop changes', 500);
  }
});

// GET /v1/reports/item-changes - Get item changes
router.get('/item-changes', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const shopId = req.query.shopId as string | undefined;

    const records = getItemChanges(limit, shopId);
    return res.success({
      count: records.length,
      records,
    });
  } catch (error) {
    console.error('Error fetching item changes:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch item changes', 500);
  }
});

// GET /v1/reports/shop-change-logs - Get shop change logs from database
router.get('/shop-change-logs', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
    const shopId = req.query.shopId as string | undefined;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    const until = req.query.until ? new Date(req.query.until as string) : undefined;

    const logs = await getShopChangeLogs({ limit, offset, shopId, since, until });
    return res.success({
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('Error fetching shop change logs:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch shop change logs', 500);
  }
});

// GET /v1/reports/item-change-logs - Get item change logs from database
router.get('/item-change-logs', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
    const shopId = req.query.shopId as string | undefined;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    const until = req.query.until ? new Date(req.query.until as string) : undefined;

    const logs = await getItemChangeLogs({ limit, offset, shopId, since, until });
    return res.success({
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('Error fetching item change logs:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch item change logs', 500);
  }
});

// GET /v1/reports/price-change-logs - Get price change logs from database
router.get('/price-change-logs', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
    const shopId = req.query.shopId as string | undefined;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;
    const until = req.query.until ? new Date(req.query.until as string) : undefined;

    const result = await getPriceChangeLogs({ limit, offset, shopId, since, until });
    return res.success({
      count: result.total,
      logs: result.rows,
    });
  } catch (error) {
    console.error('Error fetching price change logs:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch price change logs', 500);
  }
});

// GET /v1/reports/:id - Get a specific record by ID
router.get('/:id', async (req, res) => {
  try {
    const record = await getRecordById(req.params.id);
    if (record) {
      return res.success(record);
    } else {
      return res.error('NOT_FOUND', `Report record with ID ${req.params.id} not found`, 404);
    }
  } catch (error) {
    console.error('Error fetching record:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch record', 500);
  }
});

export default router;
