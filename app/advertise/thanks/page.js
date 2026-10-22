import Confirm from "./Confirm";
import site from "../../../content/site.json";
import { pageMeta } from "../../seo";
export const metadata = pageMeta({ title: "Thanks for your order", description: "Thank you. We're confirming your payment.", path: "/advertise/thanks", siteName: site.name, index: false });
export default function Thanks() { return (<article><h1>Thank you!</h1><Confirm /></article>); }
