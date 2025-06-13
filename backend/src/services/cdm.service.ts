import { AirportCapacity } from "@shared/interfaces/airport.interface";
import config from "../config";
import pilotModel, { PilotDocument } from "../models/pilot.model";
import blockUtils from "../utils/block.utils";
import timeUtils, { emptyDate } from "../utils/time.utils";
import airportService from "./airport.service";

import Logger from "@dotfionn/logger";
import pilotService from "./pilot.service";

import bookingsService from "./bookings.service";
import datafeedService from "./datafeed.service";
import dayjs from "dayjs";
import userModel from "../models/user.model";
const logger = new Logger("vACDM:services:cdm");

// Add constants at the top of the file
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const MAX_BLOCKS_TO_CHECK = 60;
const MAX_BLOCKS_TO_LOOK_AHEAD = 7;
const ASRT_PRIO_BONUS = 5;

// Helper function to check if pilot is still in planning phase (can be optimized)
function isPilotOptimizable(pilot: PilotDocument): boolean {
  return (
    timeUtils.isTimeEmpty(pilot.vacdm.asrt) && // No startup request
    timeUtils.isTimeEmpty(pilot.vacdm.aort) && // No off-block request  
    timeUtils.isTimeEmpty(pilot.vacdm.asat) && // No startup approval
    timeUtils.isTimeEmpty(pilot.vacdm.aobt) && // Not off-block
    timeUtils.isTimeEmpty(pilot.vacdm.atot)    // Not taken off
  );
}

export function determineInitialBlock(pilot: PilotDocument): {
  initialBlock: number;
  initialTtot: Date;
} {
  if (
    timeUtils.isTimeEmpty(pilot.vacdm.tobt) &&
    !timeUtils.isTimeEmpty(pilot.vacdm.eobt)
  ) {
    pilot.vacdm.tobt = pilot.vacdm.eobt;
    pilot.vacdm.tobt_state = "FLIGHTPLAN";
    logger.debug(`Using EOBT as TOBT for pilot ${pilot.callsign} as no TOBT was provided`);
  }

  if (timeUtils.isTimeEmpty(pilot.vacdm.tobt)) {
    throw new Error(`No TOBT or EOBT available for pilot ${pilot.callsign}`);
  }

  let initialTtot = timeUtils.addMinutes(pilot.vacdm.tobt, pilot.vacdm.exot);
  let initialBlock = blockUtils.getBlockFromTime(initialTtot);

  return {
    initialBlock,
    initialTtot,
  };
}

export async function putPilotIntoBlock(
  pilot: PilotDocument,
  allPilots: PilotDocument[]
): Promise<{ finalBlock: number; finalTtot: Date }> {
  // count all pilots in block
  // pilot.vacdm.ctot = emptyDate;
  const otherPilotsOnRunway = allPilots.filter(
    (plt) =>
      plt.flightplan.departure == pilot.flightplan.departure &&
      plt.vacdm.block_rwy_designator == pilot.vacdm.block_rwy_designator &&
      plt._id != pilot._id
  );
  const otherPilotsInBlock = otherPilotsOnRunway.filter(
    (plt) => plt.vacdm.blockId == pilot.vacdm.blockId
  );

  const cap: AirportCapacity = await airportService.getCapacity(
    pilot.flightplan.departure,
    pilot.vacdm.block_rwy_designator
  );

  if (cap.capacity > otherPilotsInBlock.length) {
    // pilot fits into block
    // now we have to check if pilots in block have same measures and need a MDI therefore

    for (const measure of pilot.measures) {
      const pilotsWithSameMeasures = otherPilotsOnRunway.filter(
        (plt) =>
          plt.measures.find((e) => e.ident === measure.ident) &&
          plt.callsign != pilot.callsign
      );
      if (pilotsWithSameMeasures.length > 0) {
        for (const smp of pilotsWithSameMeasures) {
          if (
            dayjs(smp.vacdm.ttot).diff(pilot.vacdm.ttot, "minute") <
            Math.ceil(measure.value / 60)
          ) {
            pilot.vacdm.ctot = timeUtils.addMinutes(
              smp.vacdm.ttot,
              Math.ceil(measure.value / 60)
            );
          }
        }
      }
    }

    return setTime(pilot);
  }

  // pilot does not fit into block

  // check if other pilot could be moved out of block
  const nowPlusTen = timeUtils.addMinutes(new Date(), 10);

  const pilotsThatCouldBeMoved = otherPilotsInBlock.filter(
    (plt) =>
      plt.vacdm.tsat > nowPlusTen &&
      plt.vacdm.prio + plt.vacdm.delay < pilot.vacdm.prio + pilot.vacdm.delay
  );

  pilotsThatCouldBeMoved.sort((pilotA, pilotB) => {
    return (
      pilotA.vacdm.prio +
        pilotA.vacdm.delay -
        (pilotB.vacdm.prio + pilotB.vacdm.delay) ||
      pilotB.vacdm.blockAssignment.valueOf() -
        pilotA.vacdm.blockAssignment.valueOf()
    );
  });

  if (pilotsThatCouldBeMoved.length > 0) {
    const pilotThatWillBeMoved = pilotsThatCouldBeMoved[0];

    pilotThatWillBeMoved.vacdm.blockId += 1;
    pilotThatWillBeMoved.vacdm.delay += 1;

    await putPilotIntoBlock(pilotThatWillBeMoved, allPilots);

    return await setTime(pilot);
  }

  // no pilot could be moved to make space
  pilot.vacdm.blockId += 1;
  pilot.vacdm.delay += 1;

  return await putPilotIntoBlock(pilot, allPilots);
}

async function findNextAvailableBlock(
  currentBlockId: number,
  pilot: PilotDocument,
  allPilots: PilotDocument[]
): Promise<number | null> {
  const capacityThisRunway: AirportCapacity = await airportService.getCapacity(
    pilot.flightplan.departure,
    pilot.vacdm.block_rwy_designator
  );

  // Search up to MAX_BLOCKS_TO_CHECK blocks ahead
  for (let i = 1; i <= MAX_BLOCKS_TO_CHECK; i++) {
    const blockId = (currentBlockId + i) % 144;
    
    // Count pilots in this potential block
    const pilotsInBlock = allPilots.filter(
      (plt) =>
        plt.flightplan.departure === pilot.flightplan.departure &&
        plt.vacdm.block_rwy_designator === pilot.vacdm.block_rwy_designator &&
        plt.vacdm.blockId === blockId &&
        !plt.inactive
    ).length;

    // Check if there's available capacity
    if (pilotsInBlock < capacityThisRunway.capacity) {
      return blockId;
    }
  }

  // No available block found
  return null;
}

async function calculateWaveEffectTTOT(
  pilot: PilotDocument,
  allPilots: PilotDocument[]
): Promise<Date> {
  // Get pilots in the same block on the same runway, sorted by block assignment time
  const pilotsInSameBlock = allPilots
    .filter(
      (plt) =>
        plt.flightplan.departure === pilot.flightplan.departure &&
        plt.vacdm.block_rwy_designator === pilot.vacdm.block_rwy_designator &&
        plt.vacdm.blockId === pilot.vacdm.blockId &&
        plt._id.toString() !== pilot._id.toString() &&
        !plt.inactive
    )
    .sort((a, b) => a.vacdm.blockAssignment.getTime() - b.vacdm.blockAssignment.getTime());

  // Get runway capacity
  const cap: AirportCapacity = await airportService.getCapacity(
    pilot.flightplan.departure,
    pilot.vacdm.block_rwy_designator
  );

  // Check for capacity overflow (include current pilot in count)
  const totalPilotsInBlock = pilotsInSameBlock.length + 1;
  if (totalPilotsInBlock > cap.capacity) {
    logger.warn(`Block capacity overflow detected for ${pilot.callsign}: ${totalPilotsInBlock} pilots > ${cap.capacity} capacity in block ${pilot.vacdm.blockId}`);
    
    // Find next available block
    const nextAvailableBlock = await findNextAvailableBlock(
      pilot.vacdm.blockId,
      pilot,
      allPilots
    );
    
    if (nextAvailableBlock !== null) {
      logger.info(`Moving ${pilot.callsign} from block ${pilot.vacdm.blockId} to block ${nextAvailableBlock} due to capacity overflow`);
      
      // Update pilot's block assignment
      const oldBlockId = pilot.vacdm.blockId;
      pilot.vacdm.blockId = nextAvailableBlock;
      pilot.vacdm.delay += (nextAvailableBlock - oldBlockId + 144) % 144;
      pilot.vacdm.blockAssignment = new Date();
      
      // Recursively calculate TTOT for new block
      return await calculateWaveEffectTTOT(pilot, allPilots);
    } else {
      logger.error(`No available block found for ${pilot.callsign}, keeping in current block ${pilot.vacdm.blockId} with capacity overflow`);
      // Continue with current block but log the overflow
    }
  }

  // Calculate this pilot's position in the block (0-based)
  // Position is determined by block assignment time - pilots assigned earlier get earlier slots
  let position = 0;
  for (const otherPilot of pilotsInSameBlock) {
    if (pilot.vacdm.blockAssignment.getTime() > otherPilot.vacdm.blockAssignment.getTime()) {
      position++;
    }
  }

  // Get block start time
  const blockStartTime = blockUtils.getTimeFromBlock(pilot.vacdm.blockId);

  // Calculate time increment within the 10-minute block
  // Distribute pilots evenly across the block based on capacity
  const blockDurationSeconds = 600; // 10 minutes
  const timeSlotDuration = Math.floor(blockDurationSeconds / cap.capacity);
  const incrementSeconds = position * timeSlotDuration;

  // Apply increment to block start time
  const ttot = new Date(blockStartTime);
  ttot.setSeconds(ttot.getSeconds() + incrementSeconds);

  // Ensure TTOT doesn't exceed block end minus 30 seconds buffer
  const blockEndTime = new Date(blockStartTime);
  blockEndTime.setMinutes(blockEndTime.getMinutes() + 10);
  blockEndTime.setSeconds(blockEndTime.getSeconds() - 30);
  
  if (ttot > blockEndTime) {
    return blockEndTime;
  }

  return ttot;
}

async function setTime(pilot: PilotDocument): Promise<{
  finalBlock: number;
  finalTtot: Date;
}> {
  if (
    pilot.vacdm.tsat > pilot.vacdm.tobt ||
    blockUtils.getBlockFromTime(pilot.vacdm.ttot) != pilot.vacdm.blockId
  ) {
    // Get all pilots for wave effect calculation
    const allPilots = await pilotService.getAllPilots({ inactive: { $eq: false } });
    
    // Use wave effect calculation to distribute pilots within the block
    pilot.vacdm.ttot = await calculateWaveEffectTTOT(pilot, allPilots);
    pilot.vacdm.tsat = timeUtils.addMinutes(
      pilot.vacdm.ttot,
      -pilot.vacdm.exot
    );
  }

  if (pilot.vacdm.tsat <= pilot.vacdm.tobt) {
    pilot.vacdm.tsat = pilot.vacdm.tobt;
    pilot.vacdm.ttot = timeUtils.addMinutes(pilot.vacdm.tsat, pilot.vacdm.exot);
  }

  if (!timeUtils.isTimeEmpty(pilot.vacdm.ctot)) {
    pilot.vacdm.blockId = blockUtils.getBlockFromTime(pilot.vacdm.ctot);
    pilot.vacdm.ttot = pilot.vacdm.ctot;
    pilot.vacdm.tsat = timeUtils.addMinutes(
      pilot.vacdm.ctot,
      -pilot.vacdm.exot
    );
  }

  await pilotService.addLog({
    pilot: pilot.callsign,
    namespace: "cdmService",
    action: "assigned block",
    data: { blockId: pilot.vacdm.blockId },
  });

  // save pilot because it might take too long between selecting the block and actually saving
  await pilot.save();

  return { finalBlock: pilot.vacdm.blockId, finalTtot: pilot.vacdm.ttot };
}

export async function cleanupPilots() {
  // Reactivate inactivated pilots (where updatedBy > disabledAt)
  const pilotsToBeEnabled = await pilotModel
    .find({
      inactive: true,
      $expr: {
        // $gt: ['$updatedAt', '$disabledAt' + 30s]
        $gt: [
          "$updatedAt",
          {
            $dateAdd: { startDate: "$disabledAt", unit: "second", amount: 15 },
          },
        ],
      },
    })
    .exec();

  logger.debug("pilotsToBeEnabled", pilotsToBeEnabled);

  for (let pilot of pilotsToBeEnabled) {
    pilot.inactive = false;
    pilot.disabledAt = emptyDate;

    await pilotService.addLog({
      pilot: pilot.callsign,
      namespace: "worker",
      action: "re-enabled pilot",
      data: {
        updated: pilot.updatedAt,
      },
    });

    logger.debug("re-enabling pilot", pilot.callsign);

    await pilot.save();
  }

  // delete long inactive pilots
  const pilotsToBeDeleted = await pilotModel
    .find({
      inactive: true,
      disabledAt: {
        $lte: new Date(
          Date.now() - config().timeframes.timeSinceInactive
        ).getTime(),
      },
    })
    .exec();

  logger.debug("pilotsToBeDeleted", pilotsToBeDeleted);

  for (let pilot of pilotsToBeDeleted) {
    pilotService.deletePilot(pilot.callsign);
    logger.debug("deleted inactive pilot", pilot.callsign);
  }

  // deactivate long not seen pilots (tobt_state==GUESS AND ((updatedAt < now - last seen) OR (tsat < now - 5))
  // do not overcompute slots with non confirmed times
  const pilotsToBeDeactivated = await pilotModel
    .find({
      inactive: { $not: { $eq: true } },
      tobt_state: { $eq: "GUESS" },
      $or: [
        {
          updatedAt: {
            $lt: new Date(
              Date.now() - config().timeframes.timeSinceLastSeen
            ).getTime(),
          },
        },
        {
          "vacdm.tsat": {
            $lt: new Date(
              Date.now() - FIVE_MINUTES_MS
            ).getTime(),
          },
        },
      ],
    })
    .exec();

  logger.debug("pilotsToBeDeactivated", pilotsToBeDeactivated);

  for (let pilot of pilotsToBeDeactivated) {
    // Improved error messages
    logger.debug(`Deactivating pilot ${pilot.callsign} due to stale GUESS TOBT state`);
    pilot.inactive = true;
    pilot.disabledAt = new Date();

    await pilotService.addLog({
      pilot: pilot.callsign,
      namespace: "worker",
      action: "deactivated pilot",
      data: {
        updated: pilot.updatedAt,
      },
    });

    logger.debug("deactivating pilot", pilot.callsign);

    await pilot.save();
  }

  // Deactivation for CONFIRMED pilots and TOBT < now() + 5 minutes (and ASAT is emptyDate)
    const pilotsConfirmedToBeDeactivated = await pilotModel
    .find({
      inactive: { $not: { $eq: true } },
      "vacdm.tobt_state": { $eq: "CONFIRMED" },
      "vacdm.tsat": {
        $lt: new Date(
          Date.now() - FIVE_MINUTES_MS
        ).getTime(),
      },
      "vacdm.asat": {
        $eq: emptyDate,
      },
    })
    .exec();

  logger.debug(
    "pilotsConfirmedToBeDeactivated",
    pilotsConfirmedToBeDeactivated
  );

  for (let pilot of pilotsConfirmedToBeDeactivated) {
    // Improved error message
    logger.debug(`Deactivating confirmed pilot ${pilot.callsign} with TSAT in the past and no ASAT`);
    pilot.inactive = true;
    pilot.disabledAt = new Date();

    await pilotService.addLog({
      pilot: pilot.callsign,
      namespace: "worker",
      action: "deactivated confirmed pilot",
      data: {
        updated: pilot.updatedAt,
      },
    });

    logger.debug("deactivating confirmed pilot", pilot.callsign);

    await pilot.save();
  }
}

export async function optimizeBlockAssignments() {
  // Use constants for optimization
  const currentBlockId = blockUtils.getBlockFromTime(new Date());
  const allAirports = await airportService.getAllAirports();

  let allPilots = await pilotService.getAllPilots({ inactive: { $eq: false } });

  const datafeedData = await datafeedService.getRawDatafeed();

  for (let pilot of allPilots) {
    logger.debug("Optimizing: ", pilot.callsign);

    // We skip optimisation if conditions are met
    if (
      pilot.hasBooking && // times already computed
      pilot.vacdm.tsat.getTime() ===
        timeUtils.subMinutes(pilot.vacdm.ctot, pilot.vacdm.exot).getTime() // TSAT is still valid
    ) {
      continue;
    }

    const datafeedPilot = await datafeedService.getFlight(
      pilot.callsign,
      datafeedData
    );

    if (datafeedPilot) {
      const pilotHasBooking = await bookingsService.pilotHasBooking(
        datafeedPilot.cid
      );

      // Has booking
      if (
        pilotHasBooking &&
        pilot.vacdm.aobt.getTime() == emptyDate.getTime() // safeguard to only update booking on blocks
      ) {
        let ctot = await bookingsService.pilotBookingCTOT(datafeedPilot.cid);
        let tsat = timeUtils.subMinutes(ctot, pilot.vacdm.exot);
        logger.debug(
          "CID: ",
          datafeedPilot.cid,
          " C/S: ",
          pilot.callsign,
          " CTOT: ",
          ctot
        );

        pilot.hasBooking = true;
        pilot.vacdm.prio += config().eventPrio;

        // Recompute times based on Booking
        pilot.vacdm.eobt = tsat;
        pilot.vacdm.tsat = tsat;
        pilot.vacdm.ctot = ctot;
        pilot.vacdm.ttot = ctot;

        // Re-calculate block based on booking ctot
        pilot.vacdm.blockId = blockUtils.getBlockFromTime(ctot);

        await pilotService.addLog({
          pilot: pilot.callsign,
          namespace: "cdmService",
          action: "booking assignment",
          data: {
            blockId: pilot.vacdm.blockId,
            source: config().eventSystemType,
            bookingCtot: ctot,
            computedTsat: tsat,
          },
        });

      }

      // All cases

      // ASRT set but ASAT not (yet) set: boost priority
      if (
        pilot.vacdm.asrt.getTime() != emptyDate.getTime() &&
        pilot.vacdm.asat.getTime() == emptyDate.getTime() &&
        pilot.vacdm.aobt.getTime() == emptyDate.getTime() // safeguard to only update booking on blocks
      ) {
        pilot.vacdm.prio += ASRT_PRIO_BONUS;
      }

      // Eventually save the pilot
      await pilot.save();
    }
  }

  const nowPlusTen = timeUtils.addMinutes(new Date(), 10);

  for (let airport of allAirports) {
    let visitedRwyDesignators: String[] = [];

    for (let rwy of airport.capacities) {
      let thisRunwayDesignator = rwy.alias || rwy.rwy_designator;

      if (visitedRwyDesignators.includes(thisRunwayDesignator)) {
        continue;
      }

      visitedRwyDesignators.push(thisRunwayDesignator);

      const pilotsThisRwy = allPilots.filter(
        (pilot) =>
          pilot.flightplan.departure === airport.icao &&
          pilot.vacdm.block_rwy_designator === thisRunwayDesignator
      );

      const capacityThisRunway: AirportCapacity =
        await airportService.getCapacity(airport.icao, thisRunwayDesignator);

      // do it
      for (
        let firstBlockCounter = 0;
        firstBlockCounter < MAX_BLOCKS_TO_CHECK;
        firstBlockCounter++
      ) {
        const firstBlockId = (currentBlockId + firstBlockCounter) % 144;

        const pilotsInThisBlock = pilotsThisRwy.filter(
          (pilot) => pilot.vacdm.blockId == firstBlockId
        ).length;

        // check for available space
        if (capacityThisRunway.capacity <= pilotsInThisBlock) {
          // no space avail
          continue;
        }

        // TODO: for the future, we need to create a score on the relevance of each pilot in this array
        const sortedMovablePilots: PilotDocument[] = [];
        let totalPilotsConsidered = 0;
        let totalPilotsExcluded = 0;

        // sort pilots for block, prio, delay
        for (
          let secondBlockCounter = 1;
          secondBlockCounter < MAX_BLOCKS_TO_LOOK_AHEAD;
          secondBlockCounter++
        ) {
          let otherBlockId = (firstBlockId + secondBlockCounter) % 144;

          const pilotsInOtherBlock = pilotsThisRwy.filter(
            (pilot) => pilot.vacdm.blockId == otherBlockId
          );
          totalPilotsConsidered += pilotsInOtherBlock.length;

          const sortedMovablePilotsThisBlock = pilotsInOtherBlock
            .filter(
              (pilot) =>
                // pilot.vacdm.tsat > nowPlusTen && // was removed after short discussion with Phil, will be removed for now
                pilot.vacdm.delay >= secondBlockCounter &&
                isPilotOptimizable(pilot) // Only optimize pilots still in planning phase
            );

          totalPilotsExcluded += pilotsInOtherBlock.length - sortedMovablePilotsThisBlock.length;

          sortedMovablePilotsThisBlock.sort(
            (pilotA, pilotB) =>
              pilotA.vacdm.prio +
              pilotA.vacdm.delay -
              (pilotB.vacdm.prio + pilotB.vacdm.delay)
          );

          sortedMovablePilots.push(...sortedMovablePilotsThisBlock);
        }

        const pilotsToMove = sortedMovablePilots.slice(
          0,
          capacityThisRunway.capacity - pilotsInThisBlock
        );

        // Log optimization effectiveness
        if (totalPilotsConsidered > 0) {
          logger.info(`Block ${firstBlockId} optimization: ${totalPilotsExcluded}/${totalPilotsConsidered} pilots excluded (already in departure phase), ${pilotsToMove.length} pilots to move`);
        }

        // move pilots to current block

        const affectedBlocks = new Set<number>();
        
        for (const pilot of pilotsToMove) {
          // Track affected blocks for wave effect recalculation
          affectedBlocks.add(pilot.vacdm.blockId); // source block
          affectedBlocks.add(firstBlockId); // destination block
          
          pilot.vacdm.delay -= (144 + pilot.vacdm.blockId - firstBlockId) % 144;
          pilot.vacdm.blockId = firstBlockId;

          logger.debug("==========>> setting pilot times", pilot.callsign);

          await setTime(pilot);
        }
        
        // Recalculate wave effect for all pilots in affected blocks
        for (const blockId of affectedBlocks) {
          const pilotsInAffectedBlock = pilotsThisRwy.filter(
            (pilot) => pilot.vacdm.blockId === blockId
          );
          
          for (const pilot of pilotsInAffectedBlock) {
            if (!pilotsToMove.includes(pilot)) {
              // Recalculate times for pilots that weren't moved but are in affected blocks
              await setTime(pilot);
            }
          }
        }
      }
    }
  }
}

export async function cleanupUsers() {
  const usersToBeDeleted = await userModel
    .find({
      vacdm: {
        admin: false,
        atc: false,
        banned: false,
      },
      updatedAt: {
        $lte: new Date(
          Date.now() - config().timeframes.timeSinceLastLogin
        ).getTime(),
      },
    })
    .exec();

  await Promise.allSettled(usersToBeDeleted.map((user) => user.delete()));
}

export default {
  determineInitialBlock,
  putPilotIntoBlock,
  cleanupPilots,
  optimizeBlockAssignments,
  cleanupUsers,
};
