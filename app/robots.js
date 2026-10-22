import site from "../content/site.json";
import { buildRobots } from "./seo";
export const dynamic = "force-static";
export default function robots() { return buildRobots(site.domain); }
