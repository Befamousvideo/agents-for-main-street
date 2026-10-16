import { searchIndex } from "../nav";
export const dynamic = "force-static";
export function GET() { return Response.json(searchIndex()); }
