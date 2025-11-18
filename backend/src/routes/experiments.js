import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createExperiment,
  listExperiments,
  deleteExperiment,
  validateCreate,
  validateList,
  validateDelete,
} from '../controllers/experimentsController.js';

const router = express.Router();

router.use(authenticateToken);
router.use(express.urlencoded({ extended: true }));
router.use(express.json());

router.post('/', validateCreate, createExperiment);
router.get('/', validateList, listExperiments);
router.delete('/:id', validateDelete, deleteExperiment);

export default router;

