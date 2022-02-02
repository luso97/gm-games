import useTitleBar from "../hooks/useTitleBar";
import { helpers, logEvent, realtimeUpdate, toWorker } from "../util";
import type { View } from "../../common/types";
import { Mood, RatingsStatsPopover } from "../components";
import { ProgressBarText } from "../components";
import { isSport } from "../../common";
import { useState } from "react";

// Show the negotiations list if there are more ongoing negotiations
const redirectNegotiationOrRoster = async (cancelled: boolean) => {
	const count = await toWorker("main", "countNegotiations", undefined);
	if (count > 0) {
		realtimeUpdate([], helpers.leagueUrl(["negotiation"]));
	} else if (cancelled || isSport("football")) {
		// After signing player in football, go back to free agents screen, cause you probably need more
		realtimeUpdate([], helpers.leagueUrl(["free_agents"]));
	} else {
		realtimeUpdate([], helpers.leagueUrl(["roster"]));
	}
};

const cancel = async (pid: number) => {
	await toWorker("main", "cancelContractNegotiation", pid);
	redirectNegotiationOrRoster(true);
};

const sign = async (pid: number, amount: number, exp: number) => {
	const errorMsg = await toWorker("main", "acceptContractNegotiation", {
		pid: pid,
		amount: Math.round(amount * 1000),
		exp,
	});
	if (errorMsg !== undefined && errorMsg) {
		logEvent({
			type: "error",
			text: errorMsg,
			saveToDb: false,
		});
	}
	redirectNegotiationOrRoster(false);
};

const Negotiation = ({
	challengeNoRatings,
	contractOptions,
	payroll,
	player = {},
	resigning,
	salaryCap,
	salaryCapType,
	maximumMinimum,
}: View<"negotiation">) => {
	useTitleBar({ title: `Contract Negotiation - ${player.name}` });

	let message;
	if (resigning && salaryCapType === "soft") {
		message = (
			<p>
				You are allowed to go over the salary cap to make this deal because you
				are re-signing{" "}
				<a href={helpers.leagueUrl(["player", player.pid])}>{player.name}</a> to
				a contract extension.{" "}
				<b>
					If you do not come to an agreement here,{" "}
					<a href={helpers.leagueUrl(["player", player.pid])}>{player.name}</a>{" "}
					will become a free agent.
				</b>{" "}
				He will then be able to sign with any team, and you won't be able to go
				over the salary cap to sign him.
			</p>
		);
	} else if (salaryCapType !== "none") {
		const extra =
			salaryCapType === "soft" ? (
				<>
					{" "}
					because{" "}
					<a href={helpers.leagueUrl(["player", player.pid])}>
						{player.name}
					</a>{" "}
					is a free agent
				</>
			) : null;

		message = (
			<p>
				You are not allowed to go over the salary cap to make this deal (unless
				it is for a minimum contract){extra}.
			</p>
		);
	}

	var contractValueArrays: number[] = contractOptions.map(
		(contract, index) => contract.amount,
	);

	const makeOffer = async (pid: number) => {
		const goodOffer =
			valueOffered.value / (contractValueArrays[valueOffered.years - 1] * 1000);
		const season = contractOptions[0].exp - contractOptions[0].years;

		if (goodOffer > 1.0) {
			sign(pid, valueOffered.value / 1000, season + valueOffered.years);
		} else {
			offer({
				...valueOffered,
				patience: valueOffered.patience - (1.0 - goodOffer),
			});
		}

		if (valueOffered.patience <= 0) {
			cancel(pid);
		}
	};
	const firstOffer = {
		years: 2,
		value: (maximumMinimum.maximum - maximumMinimum.minimum) / 2,
		patience: 1,
	};

	const [valueOffered, offer] = useState(firstOffer);

	return (
		<>
			{message}

			<p>
				Current Payroll: {helpers.formatCurrency(payroll, "M")}
				{salaryCapType !== "none" ? (
					<>
						<br />
						Salary Cap: {helpers.formatCurrency(salaryCap, "M")}
					</>
				) : null}
			</p>

			<h2>
				{" "}
				<a href={helpers.leagueUrl(["player", player.pid])}>
					{player.name}
				</a>{" "}
			</h2>
			<div className="d-flex align-items-center">
				<Mood defaultType="user" p={player} />
				<RatingsStatsPopover pid={player.pid} />
			</div>
			<p className="mt-2">
				{player.age} years old
				{!challengeNoRatings
					? `; Overall: ${player.ratings.ovr}; Potential: ${player.ratings.pot}`
					: null}
			</p>

			<div className="row">
				<div className="col-sm-10 col-md-8 col-lg-6">
					<div className="list-group">
						<label className="form-label" htmlFor="cvc">
							Salary
						</label>
						<div className="text-end me-1" style={{ minWidth: 38 }}>
							{helpers.formatCurrency(valueOffered.value / 1000, "M")} per year
						</div>
						<input
							type="range"
							value={valueOffered.value}
							className="form-range"
							min={maximumMinimum.minimum}
							max={maximumMinimum.maximum}
							onChange={e =>
								offer({ ...valueOffered, value: parseFloat(e.target.value) })
							}
							step="500"
						/>
					</div>
				</div>
			</div>
			<div className="row">
				<div className="col-sm-10 col-md-8 col-lg-6">
					<div className="list-group">
						<label className="form-label" htmlFor="cvc">
							Years
						</label>
						<div className="text-end me-1" style={{ minWidth: 38 }}>
							{valueOffered.years} years
						</div>
						<input
							type="range"
							value={valueOffered.years}
							className="form-range"
							min={maximumMinimum.minYears}
							max={maximumMinimum.maxYears}
							onChange={e =>
								offer({ ...valueOffered, years: parseFloat(e.target.value) })
							}
							step="1"
						/>
					</div>
				</div>
			</div>
			<div className="row">
				<ProgressBarText
					className="mt-3"
					text="Patience"
					percent={valueOffered.patience * 100.0}
				/>
			</div>
			<button className="btn mt-3" onClick={() => makeOffer(player.pid)}>
				Offer
			</button>
			<button
				className="btn btn-danger mt-3"
				onClick={() => cancel(player.pid)}
			>
				Can't reach a deal? End negotiation
			</button>
		</>
	);
};

export default Negotiation;
