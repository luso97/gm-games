// @flow

import deionWorker from "../../deion/worker";
import { COMPOSITE_WEIGHTS } from "../common";
import achievements from "./achievements";
import emptyPlayerStatsRow from "./emptyPlayerStatsRow";
import emptyTeamStatsRow from "./emptyTeamStatsRow";
import season from "./core/season";
import views from "./views";

// The names were generated by tools/names.js, you probably don't want to edit them by hand.
// If the list of countries changes, update the fake age code in getPlayerFakeAge.js!
//
// This weird conditional require is so Karma doesn't crash when using the big names file.
const names =
    process.env.NODE_ENV === "test"
        ? require("./data/names-test.json") // eslint-disable-line
        : require("./data/names-default.json"); // eslint-disable-line

(async () => {
    await deionWorker({
        overrides: {
            COMPOSITE_WEIGHTS,
            achievements,
            core: {
                season,
            },
            emptyPlayerStatsRow,
            emptyTeamStatsRow,
            names,
            views,
        },
    });
})();
