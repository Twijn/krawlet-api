import {Command} from "../../lib/types";
import balance from "./balance";
import findshop from "./findshop";
import krawlet from "./krawlet";
import richest from "./richest";
import names from "./names";

export default [
    balance,
    findshop,
    krawlet,
    names,
    richest,
] as Command[];