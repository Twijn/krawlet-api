import { Router } from 'express';

import all from './all';

import address from './address';
import name from './name';
import uuid from './uuid';

const router = Router();

router.use('/all', all);

router.use('/address', address);
router.use('/name', name);
router.use('/uuid', uuid);

export default router;
