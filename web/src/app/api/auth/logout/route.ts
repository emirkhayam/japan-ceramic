import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

// Только POST: GET-ссылку на logout можно было бы вызвать сторонним ресурсом (CSRF).
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", clearAuthCookie()["Set-Cookie"]);
  return response;
}
