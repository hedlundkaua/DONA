import type { NextRequest } from "next/server";
import { encaminharAuthPublico } from "@/lib/auth-proxy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return encaminharAuthPublico(req, "register");
}
