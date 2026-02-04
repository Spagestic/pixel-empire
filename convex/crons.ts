import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "respawn resources",
  { seconds: 10 },
  api.resources.respawn,
);

crons.interval(
  "adjust market prices",
  { minutes: 1 },
  api.market.adjustPrices,
);

export default crons;
