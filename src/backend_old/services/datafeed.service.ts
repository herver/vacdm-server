import axios from 'axios';

import * as VatsimTypes from '@/shared/interfaces/vatsim.interface';

export async function getRawDatafeed(): Promise<VatsimTypes.VatsimDatafeed> {
  try {
    const response = await axios.get<VatsimTypes.VatsimDatafeed>(
      'https://data.vatsim.net/v3/vatsim-data.json',
    );

    return response.data;
  } catch (e) {
    console.log('error getting datafeed', e);
    throw e;
  }
}

export async function getFlight(
  callsign: string,
  datafeed: VatsimTypes.VatsimDatafeed | undefined = undefined,
): Promise<VatsimTypes.VatsimPilot | undefined> {
  try {
    if (!datafeed) {
      datafeed = await getRawDatafeed();
    }

    const pilot = datafeed.pilots.find((p) => p.callsign == callsign);


    return pilot;
  } catch (e) {
    console.log('error getting flight from datafeed', datafeed ? 'with existing datafeed' : '', callsign, e);
    throw e;
  }
}

export async function getFlightByCid(
  cid: number,
): Promise<VatsimTypes.VatsimPilot | undefined> {
  try {
    const datafeed = await getRawDatafeed();

    const pilot = datafeed.pilots.find((p) => p.cid == cid);


    return pilot;
  } catch (e) {
    console.log('error getting flight from datafeed', cid, e);
    throw e;
  }
}

export default { getRawDatafeed, getFlight, getFlightByCid };
