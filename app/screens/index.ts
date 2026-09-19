import type { ComponentType } from "react";
import type { ScreenProps } from "../components/Screen";
import type { ScreenName } from "../core/router";
import DemandDetail from "./DemandDetail";
import Coords from "./Coords";
import DemandMap from "./DemandMap";
import DemandPost from "./DemandPost";
import FoodDetail from "./FoodDetail";
import Home from "./Home";
import LangCountry from "./LangCountry";
import Nearby from "./Nearby";
import Photo from "./Photo";
import Price from "./Price";
import Settings from "./Settings";
import { History } from "./Trends";
import Where from "./Where";

/** The three-level menu tree of docs/ARCHITECTURE.md, one entry per node. */
export const SCREENS: Record<ScreenName, ComponentType<ScreenProps>> = {
  home: Home,
  photo: Photo,
  food: FoodDetail,
  map: DemandMap,
  price: Price,
  history: History,
  post: DemandPost,
  demand: DemandDetail,
  settings: Settings,
  langsel: LangCountry,
  where: Where,
  near: Nearby,
  coords: Coords,
};
