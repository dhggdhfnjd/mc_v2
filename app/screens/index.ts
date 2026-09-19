import type { ComponentType } from "react";
import type { ScreenProps } from "../components/Screen";
import type { ScreenName } from "../core/router";
import Area from "./Area";
import Border from "./Border";
import Calc from "./Calc";
import CloseDeal from "./CloseDeal";
import DemandMap from "./DemandMap";
import { DemandDetail, DemandList } from "./Demands";
import { PostDemand, Report } from "./Forms";
import Home from "./Home";
import Ledger from "./Ledger";
import Menu from "./Menu";
import Photo from "./Photo";
import Price from "./Price";
import Settings from "./Settings";
import ShowCard from "./ShowCard";
import { History, Season } from "./Trends";

/** one screen per team decision — see docs/ARCHITECTURE.md for the D1–D15 mapping */
export const SCREENS: Record<ScreenName, ComponentType<ScreenProps>> = {
  home: Home, // D1
  area: Area, // D2
  price: Price, // D3
  calc: Calc, // D4 + bargaining
  card: ShowCard,
  close: CloseDeal, // D5, D12, D13
  menu: Menu,
  demands: DemandList, // D7
  map: DemandMap, // D8
  demand: DemandDetail,
  post: PostDemand, // D7
  history: History, // D9
  season: Season, // D10
  report: Report, // D11
  ledger: Ledger, // D12
  border: Border,
  photo: Photo,
  settings: Settings,
};
