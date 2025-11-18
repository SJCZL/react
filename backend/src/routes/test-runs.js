import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createTestRun,
  listTestRuns,
  addTestCases,
  listTestCases,
  getRunSummary
} from '../controllers/testResultsController.js';

const router = express.Router();

router.use(authenticateToken);
router.use(express.urlencoded({ extended: true }));
router.use(express.json({ limit: '10mb' }));

router.get('/', listTestRuns);
router.post('/', createTestRun);
router.post('/:id/cases', addTestCases);
router.get('/:id/cases', listTestCases);
router.get('/:id/summary', getRunSummary);

export default router;
