import {Command} from "../../lib/types";
import balance from "./balance";
import richest from "./richest";
import names from "./names";

export default [
    balance,
    names,
    richest,
] as Command[];