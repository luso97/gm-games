import { PHASE } from "../../../common";
import { idb } from "../../db";
import { g, helpers, lock, updatePlayMenu, updateStatus } from "../../util";

/**
 * Cancel contract negotiations with a player.
 */
const cancel = async (pid: number) => {
	if (!g.get("negotiations")) {
		await idb.cache.negotiations.delete(pid);
	}
	const negotiationInProgress = await lock.negotiationInProgress();

	if (!negotiationInProgress && !g.get("negotiations")) {
		if (g.get("phase") === PHASE.FREE_AGENCY) {
			await updateStatus(helpers.daysLeft(true));
		} else {
			await updateStatus("Idle");
		}

		updatePlayMenu();
	}
};

export default cancel;
