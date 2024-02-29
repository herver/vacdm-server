import { NextFunction, Request, Response } from 'express';

import ecfmpService from '../services/ecfmp.service';

import { APIError } from '@/shared/errors';
import { RogerPlugin } from '@/shared/interfaces/rogerPlugin.interface';

export async function getAllMeasures(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const measures = await ecfmpService.getAllMeasures();

    res.json(measures);
  } catch (error) {
    next(error);
  }
}

export async function getLegacyMeasures(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const aerodromes = req.query.aerodromes;

  if (aerodromes == null) {
    return next(
      new APIError('aerodromes is a required query parameter', null, 400),
    );
  }

  if (Array.isArray(aerodromes)) {
    return next(
      new APIError(
        'aerodromes must be a comma-separated string of ICAO-codes',
        null,
        400,
      ),
    );
  }

  const relevantAerodromes = aerodromes.toString().split(',');

  try {
    const measures = await ecfmpService.getAllMeasures();

    const legacyMeasures: RogerPlugin = { MDI: [] };

    /*     measures.forEach((element: EcfmpMeasure) => {
      if (element.measure.type != "minimum_departure_interval") {return;}

      let thisMeasure: RogerPluginMeasure = {
        TIME: Math.ceil (element.measure.value / 60)

      };

        {
          "TIME": 3, // MDI
          "DEPA": "ALL",
          "DEST": "LPPT",
          "VALIDDATE": "07/04", // Valid date day/month (ex. "07/04").
          "VALIDTIME": "1700-1900", // Valid date start-end (ex. "1700-1900").
          "MESSAGE": "LPPT Thursdays"
         },
      
    }) 
 */
    res.json(measures);
  } catch (error) {
    next(error);
  }
}

export async function editMeasure(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { id } = req.params;

    const numId = Number(id);

    if (Number.isNaN(numId)) {
      return res.status(400).json({ msg: 'id must be numeric' });
    }

    const measure = await ecfmpService.editMeasure(numId, req.body);

    res.json(measure);
  } catch (error) {
    next(error);
  }
}

export default {
  getAllMeasures,
  getLegacyMeasures,
  editMeasure,
};
