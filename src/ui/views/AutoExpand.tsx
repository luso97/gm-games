import { useState } from "react";
import useTitleBar from "../hooks/useTitleBar";
import type { View } from "../../common/types";
import { toWorker } from "../util";
import { TeamLogoJerseyInfo } from "../components/TeamLogoJerseyInfo";
import { wait } from "../../common";
import { AutoRelocateExpandSubmit } from "./AutoRelocate";

const AutoExpand = ({ godMode, newTeams }: View<"autoExpand">) => {
	useTitleBar({ title: "League Expansion Vote" });

	const [override, setOverride] = useState(false);

	const [status, setStatus] = useState<
		| {
				type: "init";
		  }
		| {
				type: "voted";
		  }
		| {
				type: "results";
				for: number;
				against: number;
		  }
	>({ type: "init" });

	const vote = async (userVote: boolean) => {
		if (status.type !== "init") {
			return;
		}
		setStatus({
			type: "voted",
		});

		const results = await toWorker("main", "expandVote", {
			override,
			userVote,
		});

		await wait(2000);

		setStatus({
			type: "results",
			...results,
		});
	};

	return (
		<>
			<div className="mb-5 fs-5">
				{newTeams.length === 1
					? "An expansion team wants"
					: `${newTeams.length} expansion teams want`}{" "}
				to join the league.
			</div>

			<div className="d-flex flex-wrap gap-5 mb-5">
				{newTeams.map((newTeam, i) => (
					<TeamLogoJerseyInfo
						key={i}
						brandedTeam={newTeam}
						selectedTeam={newTeam}
					/>
				))}
			</div>

			<AutoRelocateExpandSubmit
				godMode={godMode}
				override={override}
				setOverride={setOverride}
				status={status}
				vote={vote}
				voteTextYes={`Approve expansion team${newTeams.length > 1 ? "s" : ""}`}
				voteTextNo="No expansion"
				resultTextYes="Expansion approved!"
				resultTextNo="Expansion denied!"
			/>
		</>
	);
};

export default AutoExpand;
