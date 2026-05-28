import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function GET() {
  const response = NextResponse.redirect(new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  response.headers.set("Set-Cookie", clearAuthCookie()["Set-Cookie"]);
  return response;
}
