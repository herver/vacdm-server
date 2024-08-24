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
          logger.debug("Get latest VatCAN Bookings");
          const bookings = await axios.get(config().eventUrl);

          relevantBookings = [];
          for (let booking of bookings.data) {
            relevantBookings.push(booking);
          }
          // logger.debug(relevantBookings);
          return relevantBookings;
          break;

        default:
          logger.debug("Get latest BMAC Bookings");
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
          return relevantBookings;
          break;
      }
    }
  } catch (error) {
    throw error;
  }

  // We shouldn't be here
  return [];
}

export async function pilotHasBooking(cid: number): Promise<boolean> {
  try {
    const bookings = await getAllBookings();
    // logger.debug("pilotHasBooking: cid ->", cid);
    // logger.debug("All bookings", bookings);
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
