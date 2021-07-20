import flatten from "lodash-es/flatten";
import { g, random } from "../../../worker/util";
import newScheduleCrappy from "./newScheduleCrappy";

type MyTeam = {
	seasonAttrs: {
		cid: number;
		did: number;
	};
	tid: number;
};

const groupTeamsByDid = (teams: MyTeam[]) => {
	const divs = g.get("divs");

	const teamsGroupedByDid: Record<
		number,
		{
			div: MyTeam[];
			conf: MyTeam[];
			other: MyTeam[];
		}
	> = {};

	for (const div of divs) {
		teamsGroupedByDid[div.did] = {
			div: teams.filter(t => t.seasonAttrs.did === div.did),
			conf: teams.filter(
				t => t.seasonAttrs.did !== div.did && t.seasonAttrs.cid === div.cid,
			),
			other: teams.filter(t => t.seasonAttrs.cid !== div.cid),
		};
	}

	return teamsGroupedByDid;
};

const getNumGamesTargetsByDid = (
	teamsGroupedByDid: ReturnType<typeof groupTeamsByDid>,
) => {
	const numGames = g.get("numGames");
	const numGamesDiv = 16;
	const numGamesConf = 36;
	const numGamesOther = numGames - numGamesDiv - numGamesConf;
	if (numGamesOther < 0) {
		throw new Error(
			"Can't have more division and conference games than total games",
		);
	}

	const numGamesTargetsByDid: Record<
		number,
		{
			// Number of games played against every single team in (Div: same division; Conf: same conference but not same division; Other: not in same conference)
			perTeam: {
				div: number;
				conf: number;
				other: number;
			};

			// Number of total games that need to be played in the division/conference/other, but can't be spread evenly across all teams
			excess: {
				div: number;
				conf: number;
				other: number;
			};
		}
	> = {};

	const divs = g.get("divs");
	const numActiveTeams = g.get("numActiveTeams");

	for (const div of divs) {
		const divSize = teamsGroupedByDid[div.did].div.length;
		if (divSize === 0) {
			continue;
		}

		const confSize = teamsGroupedByDid[div.did].conf.length;

		// -1 for div size because that's the only one that includes the given team
		const denominators = {
			div: divSize - 1,
			conf: confSize,
			other: numActiveTeams - confSize - divSize,
		};

		numGamesTargetsByDid[div.did] = {
			perTeam: {
				div: Math.floor(numGamesDiv / denominators.div),
				conf: Math.floor(numGamesConf / denominators.conf),
				other: Math.floor(numGamesOther / denominators.other),
			},
			excess: {
				div: numGamesDiv % denominators.div,
				conf: numGamesConf % denominators.conf,
				other: numGamesOther % denominators.other,
			},
		};
	}

	return numGamesTargetsByDid;
};

const initScheduleCounts = (teams: MyTeam[]) => {
	// Keep track of the number of home/away/either games assigned to each team, at either the div/conf/other level. "either" means that it's been determined a game between two teams is definitely necessary, but it has not yet been determined if it's a home or away game. Like if two teams only play each other twice, each will have one home and one away game. But if they play three times, there will be one more game that could go either way.
	const scheduleCounts: Record<
		number,
		Record<
			"conf" | "div" | "other",
			{
				home: number;
				away: number;
				either: number;
			}
		>
	> = {};

	for (const t of teams) {
		scheduleCounts[t.tid] = {
			div: { home: 0, away: 0, either: 0 },
			conf: { home: 0, away: 0, either: 0 },
			other: { home: 0, away: 0, either: 0 },
		};
	}

	return scheduleCounts;
};

const newScheduleGood = (teams: MyTeam[]): [number, number][] | undefined => {
	const teamsGroupedByDid = groupTeamsByDid(teams);
	const numGamesTargetsByDid = getNumGamesTargetsByDid(teamsGroupedByDid);
	const scheduleCounts = initScheduleCounts(teams);

	const tids: [number, number][] = []; // tid_home, tid_away
	const tidsEither: [number, number][] = []; // home/away not yet set, add to tids later

	// Make all the required matchups (perTeam)
	const levels = ["div", "conf", "other"] as const;
	for (const t of teams) {
		const teamsGrouped = teamsGroupedByDid[t.seasonAttrs.did];
		const numGamesTargets = numGamesTargetsByDid[t.seasonAttrs.did];

		for (const level of levels) {
			const group = teamsGrouped[level];

			for (const t2 of group) {
				if (t.tid === t2.tid) {
					continue;
				}

				// Record home games, away games will be handled by t2
				const numHome = Math.floor(numGamesTargets.perTeam[level] / 2);
				for (let i = 0; i < numHome; i++) {
					tids.push([t.tid, t2.tid]);
					scheduleCounts[t.tid][level].home += 1;
					scheduleCounts[t2.tid][level].away += 1;
				}

				// Record either games only for the lower tid, so they don't get double counted
				if (t.tid < t2.tid) {
					const numEither = numGamesTargets.perTeam[level] % 2;
					for (let i = 0; i < numEither; i++) {
						tidsEither.push([t.tid, t2.tid]);
						scheduleCounts[t.tid][level].either += 1;
						scheduleCounts[t2.tid][level].either += 1;
					}
				}
			}
		}
	}

	console.log("teamsGroupedByDid", teamsGroupedByDid);
	console.log("numGamesTargetsByDid", numGamesTargetsByDid);
	console.log("scheduleCounts", scheduleCounts);
	console.log("tids", tids);
	console.log("tidsEither", tidsEither);

	// Everything above is deterministic, but below is where randomness is introduced

	// Make all the excess matchups (for odd number of games between teams, someone randomly gets an extra home game)

	// Assign all the "either" games to home/away, while balancing home/away within div/conf/other

	return tids;
};

/**
 * Wrapper function to generate a new schedule with the appropriate algorithm based on the number of teams in the league.
 *
 * For leagues with NBA-like structure, use newScheduleDefault. Otherwise, newScheduleCrappy.
 *
 * @memberOf core.season
 * @return {Array.<Array.<number>>} All the season's games. Each element in the array is an array of the home team ID and the away team ID, respectively.
 */
const newSchedule = (teams: MyTeam[]) => {
	let tids = newScheduleGood(teams);

	if (!tids) {
		tids = newScheduleCrappy(teams);
	}

	// Order the schedule so that it takes fewer days to play
	random.shuffle(tids);
	const days: [number, number][][] = [[]];
	const tidsInDays: number[][] = [[]];
	let jMax = 0;

	for (let i = 0; i < tids.length; i++) {
		let used = false;

		for (let j = 0; j <= jMax; j++) {
			if (
				!tidsInDays[j].includes(tids[i][0]) &&
				!tidsInDays[j].includes(tids[i][1])
			) {
				tidsInDays[j].push(tids[i][0]);
				tidsInDays[j].push(tids[i][1]);
				days[j].push(tids[i]);
				used = true;
				break;
			}
		}

		if (!used) {
			days.push([tids[i]]);
			tidsInDays.push([tids[i][0], tids[i][1]]);
			jMax += 1;
		}
	}

	random.shuffle(days);

	// Otherwise the most dense days will be at the beginning and the least dense days will be at the end
	tids = flatten(days);

	return tids;
};

export default newSchedule;