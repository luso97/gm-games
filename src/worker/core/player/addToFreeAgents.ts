import { PHASE, PLAYER } from "../../../common";
import genContract from "./genContract";
import setContract from "./setContract";
import { g, helpers, random } from "../../util";
import type {
	MinimalPlayerRatings,
	Phase,
	Player,
	PlayerWithoutKey,
} from "../../../common/types";

/**
 * Adds player to the free agents list.
 *
 * This should be THE ONLY way that players are added to the free agents
 * list, because this will also calculate their demanded contract and mood.
 *
 * @memberOf core.player
 * @param {Object} p Player object.
 * @param {?number} phase An integer representing the game phase to consider this transaction under (defaults to g.get("phase") if null).
 * @param {Array.<number>} baseMoods Vector of base moods for each team from 0 to 1, as generated by genBaseMoods.
 */
const addToFreeAgents = (
	p: Player<MinimalPlayerRatings> | PlayerWithoutKey<MinimalPlayerRatings>,
	phase: Phase,
	baseMoods: number[],
) => {
	phase = phase !== null ? phase : g.get("phase");
	const pr = p.ratings[p.ratings.length - 1];
	setContract(p, genContract(p), false); // Set initial player mood towards each team

	p.freeAgentMood = baseMoods.map(mood => {
		if (pr.ovr + pr.pot < 80) {
			// Bad players don't have the luxury to be choosy about teams
			return 0;
		}

		if (phase === PHASE.RESIGN_PLAYERS) {
			// More likely to re-sign your own players
			return helpers.bound(mood + random.uniform(-1, 0.5), 0, 1000);
		}

		return helpers.bound(mood + random.uniform(-1, 1.5), 0, 1000);
	});

	// During regular season, or before season starts, allow contracts for	// just this year.

	if (phase > PHASE.AFTER_TRADE_DEADLINE) {
		p.contract.exp += 1;
	}

	p.tid = PLAYER.FREE_AGENT;
	p.ptModifier = 1; // Reset
};

export default addToFreeAgents;
