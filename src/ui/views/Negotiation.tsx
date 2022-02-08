import useTitleBar from "../hooks/useTitleBar";
import classNames from "classnames";
import { helpers, logEvent, realtimeUpdate, toWorker } from "../util";
import type { View } from "../../common/types";
import { Mood, RatingsStatsPopover } from "../components";
import { ProgressBarText } from "../components";
import { isSport } from "../../common";
import { useState } from "react";
import { idb } from "src/worker/db";

// Show the negotiations list if there are more ongoing negotiations
const redirectNegotiationOrRoster = async (
	cancelled: boolean,
	negotiations = false,
) => {
	const count = await toWorker("main", "countNegotiations", undefined);
	if (count > 0 && !negotiations) {
		realtimeUpdate([], helpers.leagueUrl(["negotiation"]));
	} else if (cancelled || isSport("football")) {
		// After signing player in football, go back to free agents screen, cause you probably need more
		realtimeUpdate([], helpers.leagueUrl(["free_agents"]));
	} else {
		realtimeUpdate([], helpers.leagueUrl(["roster"]));
	}
};

const cancel = async (pid: number, negotiations = false) => {
	await toWorker("main", "cancelContractNegotiation", pid);
	redirectNegotiationOrRoster(true, negotiations);
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
	negotiationsBoolean,
	negotiation,
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

	let offers: number = negotiation.offers || 0;

	let contractValueArrays: number[] =
		negotiation.contractValueArrays ||
		contractOptions.map(
			contract => contract.amount * (1 + Math.random() * 0.2),
		);

	const originalValueArrays =
		negotiation.originalValueArrays || contractValueArrays;

	const makeOffer = async (pid: number) => {
		console.log({
			...negotiation,
			patience: valueOffered.patience,
			originalValueArrays: originalValueArrays,
			contractValueArrays: contractValueArrays,
			offers: offers,
		});

		//idb.cache.negotiations.cache.fill()
		offers++;
		const goodOffer =
			valueOffered.value / (contractValueArrays[valueOffered.years - 1] * 1000);
		const season = contractOptions[0].exp - contractOptions[0].years;
		var patienceTemp = 1.0;
		if (goodOffer > 1.0) {
			sign(pid, valueOffered.value / 1000, season + valueOffered.years);
		} else {
			contractValueArrays = contractValueArrays.map((value, index) =>
				Math.max(
					originalValueArrays[index] * 0.95,
					value * 0.9 + Math.random() * 0.1,
				),
			);
			patienceTemp = valueOffered.patience - offers * (1.0 - goodOffer);
			offer({
				...valueOffered,
				patience: patienceTemp,
			});
		}
		toWorker("main", "updateContractNegotiation", {
			...negotiation,
			patience: patienceTemp,
			originalValueArrays: originalValueArrays,
			contractValueArrays: contractValueArrays,
			offers: offers,
		});
		if (patienceTemp <= 0) {
			offer({
				...valueOffered,
				patience: 0,
			});
			const errorMsg = "Player ended negotiations because lacking progress";
			logEvent({
				type: "error",
				text: errorMsg,
				saveToDb: false,
			});
			await cancel(pid, true);
		}
	};
	const firstOffer = {
		years: 2,
		value: (maximumMinimum.maximum - maximumMinimum.minimum) / 2,
		patience: negotiation.patience || 1,
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
			{negotiationsBoolean ? (
				<div>
					<div className="row">
						<div className="col-sm-10 col-md-8 col-lg-6">
							<div className="list-group">
								<label className="form-label" htmlFor="cvc">
									Salary
								</label>
								<div className="text-end me-1" style={{ minWidth: 38 }}>
									{helpers.formatCurrency(valueOffered.value / 1000, "M")} per
									year
								</div>
								<input
									type="range"
									value={valueOffered.value}
									className="form-range"
									min={maximumMinimum.minimum}
									max={maximumMinimum.maximum}
									onChange={e =>
										offer({
											...valueOffered,
											value: parseFloat(e.target.value),
										})
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
										offer({
											...valueOffered,
											years: parseFloat(e.target.value),
										})
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
				</div>
			) : (
				<div className="row">
					<div className="col-sm-10 col-md-8 col-lg-6">
						<div className="list-group">
							{contractOptions.map((contract: any, i: number) => {
								return (
									<div
										key={i}
										className={classNames(
											"d-flex align-items-center list-group-item",
											{
												"list-group-item-success": contract.smallestAmount,
											},
										)}
									>
										<div className="flex-grow-1">
											{helpers.formatCurrency(contract.amount, "M")} per year
											<span className="d-none d-sm-inline">
												, through {contract.exp}
											</span>{" "}
											({contract.years}{" "}
											{contract.years === 1 ? "season" : "seasons"})
										</div>

										<button
											className="btn btn-success"
											onClick={() =>
												sign(player.pid, contract.amount, contract.exp)
											}
										>
											Sign
											<span className="d-none d-sm-inline"> Contract</span>
										</button>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}
			<button
				className="btn btn-danger mt-3"
				onClick={() => cancel(player.pid, negotiationsBoolean)}
			>
				Can't reach a deal? End negotiation
			</button>
		</>
	);
};

export default Negotiation;
