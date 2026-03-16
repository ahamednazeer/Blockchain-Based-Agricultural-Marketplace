import Transaction from "../models/Transaction.js";

export function startFulfillmentMonitor() {
  const intervalMs = Number(process.env.FULFILLMENT_CHECK_INTERVAL_MS || 1000 * 60 * 60);
  const shipAfterHours = Number(process.env.FULFILLMENT_AUTO_SHIP_HOURS || 6);
  const deliverAfterHours = Number(process.env.FULFILLMENT_AUTO_DELIVER_HOURS || 48);

  const runCheck = async () => {
    const now = new Date();
    const shipBefore = new Date(now.getTime() - shipAfterHours * 60 * 60 * 1000);
    const deliverBefore = new Date(now.getTime() - deliverAfterHours * 60 * 60 * 1000);

    await Transaction.updateMany(
      {
        status: "CONFIRMED",
        fulfillmentStatus: "PENDING",
        createdAt: { $lte: shipBefore },
      },
      {
        fulfillmentStatus: "SHIPPED",
        pickupStatus: "PICKED_UP",
        transitStatus: "IN_TRANSIT",
        pickupAt: now,
        transitAt: now,
        updatedAt: now,
      }
    );

    await Transaction.updateMany(
      {
        status: "CONFIRMED",
        fulfillmentStatus: "SHIPPED",
        updatedAt: { $lte: deliverBefore },
      },
      {
        fulfillmentStatus: "DELIVERED",
        transitStatus: "DELIVERED",
        deliveredAt: now,
        updatedAt: now,
      }
    );

    await Transaction.updateMany(
      {
        status: "CONFIRMED",
        deliveredAt: { $ne: null },
        slaDeadlineAt: { $ne: null, $lt: now },
      },
      {
        slaBreached: true,
      }
    );
  };

  runCheck();
  setInterval(runCheck, intervalMs);
}
