import { NextResponse } from "next/server";

const SERVICE_BASE = process.env.CALENDAR_SERVICE;

export async function GET() {
  try {
    const res = await fetch(`${SERVICE_BASE}/services/catalog`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("GET /api/services/catalog proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}