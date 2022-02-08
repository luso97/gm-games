import type { Negotiation } from "src/common/types";
import { g } from "src/worker/util";
import { idb } from "../../db";

const update = async (negotiation: Negotiation): Promise<number | void> => {
	if (negotiation != undefined) {
		await idb.cache.negotiations.delete(negotiation.pid);
		let value = await idb.cache.negotiations.add(negotiation);
		return value;
	}
};

export default update;
