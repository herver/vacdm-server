import { NextFunction, Request, Response } from 'express';

import bookingsService from '../services/bookings.service';
import Logger from "@dotfionn/logger";

const logger = new Logger("vACDM:services:bookings");

export async function purgeBookingsCache(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { callsign } = req.params;

  try {
    const result = await bookingsService.purgeBookingsCache(callsign);
    logger.error(`Purged bookings cache for callsign ${callsign}`);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export default {
  purgeBookingsCache,
};
