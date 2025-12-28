import { Router } from 'express';
import items from './items';
import shops from './shops';
import reports from './reports';

const router = Router();

router.use('/items', items);
router.use('/shops', shops);
router.use('/reports', reports);

export default router;
