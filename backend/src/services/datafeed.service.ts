import axios from 'axios';
import * as VatsimTypes from '@shared/interfaces/vatsim.interface';

// Cache storage interface
interface CacheEntry {
  data: VatsimTypes.VatsimDatafeed;
  expiry: number; // Timestamp when the cache expires
}

// Cache storage
let dataCache: CacheEntry | null = null;

export async function getRawDatafeed(): Promise<VatsimTypes.VatsimDatafeed> {
  try {
    // Check if we have valid cache
    if (dataCache && Date.now() < dataCache.expiry) {
      return dataCache.data;
    }

    // No valid cache or expired, fetch new data
    const response = await axios.get<VatsimTypes.VatsimDatafeed>(
      'https://data.vatsim.net/v3/vatsim-data.json'
    );

    // Parse cache-control header
    const cacheControl = response.headers['cache-control'];
    let maxAge = 30; // Default to 30 seconds if no cache-control header
    
    if (cacheControl) {
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch && maxAgeMatch[1]) {
        maxAge = parseInt(maxAgeMatch[1], 10);
      }
    }

    // Store in cache with expiry time
    dataCache = {
      data: response.data,
      expiry: Date.now() + (maxAge * 1000)
    };

    return response.data;
  } catch (error) {
    throw error;
  }
}

export async function getFlight(
  callsign: string,
  datafeed: VatsimTypes.VatsimDatafeed | undefined = undefined
): Promise<VatsimTypes.VatsimPilot | undefined> {
  try {
    if (!datafeed) {
      datafeed = await getRawDatafeed();
    }

    const pilot = datafeed.pilots.find((p) => p.callsign == callsign);

    return pilot;
  } catch (error) {
    throw error;
  }
}

export async function getFlightByCid(
  cid: number
): Promise<VatsimTypes.VatsimPilot | undefined> {
  try {
    const datafeed = await getRawDatafeed();

    const pilot = datafeed.pilots.find((p) => p.cid == cid);

    return pilot;
  } catch (error) {
    throw error;
  }
}

export default { getRawDatafeed, getFlight, getFlightByCid };
