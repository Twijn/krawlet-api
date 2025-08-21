import {Command} from "../../lib/types";
import ads from "./ads";
import balance from "./balance";
import krawlet from "./krawlet";
import richest from "./richest";
import names from "./names";

export default [
    ads,
    balance,
    krawlet,
    names,
    richest,
] as Command[];