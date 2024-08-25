import axios from "axios";
import config from "../config";
import dayjs from "dayjs";
import Logger from "@dotfionn/logger";

const logger = new Logger("vACDM:services:booking");

let lastPull: Date | null = null;
let relevantBookings: any[] | null = null;

export async function getAllBookings() {
  const duration = dayjs().diff(dayjs(lastPull), "minute");

  try {
    if (
      relevantBookings === null ||
      lastPull === null ||
      duration > config().eventPullInterval
    ) {
      switch (config().eventSystemType) {
        case "vatcan":
          logger.debug("Fetching VatCAN Bookings");
          const bookings = await axios.get(config().eventUrl);

          relevantBookings = [];
          for (let booking of bookings.data) {
            relevantBookings.push(booking);
          }
          lastPull = new Date();

          return relevantBookings;
          break;

        default:
          logger.debug("Fetching BMAC Bookings");
          const events = await axios.get(config().eventUrl);
          const relevantEvents = events.data.data.filter(
            (e) =>
              dayjs(new Date()) >= dayjs(e.startEvent) &&
              dayjs(new Date()) <= dayjs(e.endEvent)
          );
          relevantBookings = [];

          for (let event of relevantEvents) {
            const bookings = await axios.get(event.links.bookings);

            for (let booking of bookings.data.data) {
              relevantBookings.push(booking);
            }
          }
          lastPull = new Date();

          return relevantBookings;
          break;
      }
    } else {
      // logger.debug("Returning cached bookings from: ", lastPull);
      return relevantBookings;
    }
  } catch (error) {
    throw error;
  }
}

export async function pilotHasBooking(cid: number): Promise<boolean> {
  try {
    const bookings = await getAllBookings();

    switch (config().eventSystemType) {
      case "vatcan":
        return bookings.findIndex((b) => b.cid === cid) != -1;
        break;
      default:
        return bookings.findIndex((b) => b.user === cid) != -1;
        break;
    }
  } catch (error) {
    throw error;
  }
}

export async function pilotBookingCTOT(cid: number): Promise<Date> {
  try {
    const bookings = await getAllBookings();
    // Slot VatCAN is the CTOT
    let raw_ctot: String = bookings.find((b) => b.cid === cid).slot;

    // Construct date object
    let ctot = dayjs().startOf('day')
    .add(Number(raw_ctot.substring(0, 2)), 'hour')
    .add(Number(raw_ctot.substring(2, 4)), 'minute');
    
    return ctot.toDate();
  } catch (error) {
    throw error;
  }
}

export default {
  getAllBookings,
  pilotHasBooking,
  pilotBookingCTOT,
};
