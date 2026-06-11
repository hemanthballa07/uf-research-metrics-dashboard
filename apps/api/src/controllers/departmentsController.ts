import type { Request, Response } from 'express';
import { getAllDepartments } from '../services/departmentsService.js';

export async function getDepartmentsHandler(req: Request, res: Response): Promise<void> {
  const departments = await getAllDepartments();
  res.status(200).json(departments);
}

