import {Command} from "../../lib/types";
import balance from "./balance";
import krawlet from "./krawlet";
import richest from "./richest";
import names from "./names";

export default [
    balance,
    krawlet,
    names,
    richest,
] as Command[];