import { NextRequest, NextResponse } from "next/server";

const SERVICE_BASE = process.env.CALENDAR_SERVICE;

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search");
    const url = new URL(`${SERVICE_BASE}/services`);

    if (search) {
      url.searchParams.set("search", search);
    }

    const res = await fetch(url.toString(), {
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
    console.error("GET /api/services proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const res = await fetch(`${SERVICE_BASE}/services`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("POST /api/services proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}