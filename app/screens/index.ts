import type { ComponentType } from "react";
import type { ScreenProps } from "../components/Screen";
import type { ScreenName } from "../core/router";
import DealDetail from "./DealDetail";
import DemandDetail from "./DemandDetail";
import DemandMap from "./DemandMap";
import FoodDetail from "./FoodDetail";
import FoodInput from "./FoodInput";
import FoodPick from "./FoodPick";
import Home from "./Home";
import Nearby from "./Nearby";
import LangCountry from "./LangCountry";
import Ledger from "./Ledger";
import Photo from "./Photo";
import Price from "./Price";
import Settings from "./Settings";
import { History } from "./Trends";

/** The three-level menu tree of docs/ARCHITECTURE.md, one entry per node. */
export const SCREENS: Record<ScreenName, ComponentType<ScreenProps>> = {
  // L1
  home: Home,
  // L2 — food input, then the three filtered views
  foodin: FoodInput,
  pick: FoodPick,
  photo: Photo,
  map: DemandMap,
  price: Price,
  history: History,
  // L2 — the two simple branches
  ledger: Ledger,
  settings: Settings,
  near: Nearby,
  // L3
  food: FoodDetail,
  demand: DemandDetail,
  deal: DealDetail,
  langsel: LangCountry,
};
