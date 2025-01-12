import axios from 'axios'

async function purgeBookingsCache(callsign: string): Promise<boolean> {
  try {
    const response = await axios.delete('/api/v1/bookings/cache/' + callsign);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export default {
  purgeBookingsCache
}




