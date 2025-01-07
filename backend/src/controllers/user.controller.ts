import { NextFunction, Request, Response } from 'express';
import userService from '../services/user.service';
import { UserDocument } from '../models/user.model';

export async function getAllUsers(
  req: Request,
  res: Response, 
  next: NextFunction
) {
  try {
    if (!req.user?.vacdm.admin) {
      return res.status(403).json({error: 'Unauthorized'});
    }
    const users: UserDocument[] = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
}

export async function updateUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user?.vacdm.admin) {
      return res.status(403).json({error: 'Unauthorized'});
    }
    const userId = req.params.id;
    const updates = req.body;
    const user = await userService.updateUser(userId, updates);
    res.json(user);
  } catch (error) {
    next(error);
  }
}

export default {
  getAllUsers,
  updateUser
};