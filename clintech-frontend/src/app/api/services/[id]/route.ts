import { NextRequest, NextResponse } from "next/server";

const SERVICE_BASE = process.env.CALENDAR_SERVICE;

type Context = {
  params: Promise<{ id: string }>;
};

export async function PUT(req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const body = await req.text();

    const res = await fetch(`${SERVICE_BASE}/services/${id}`, {
      method: "PUT",
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
    console.error("PUT /api/services/[id] proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: Context) {
  try {
    const { id } = await context.params;

    const res = await fetch(`${SERVICE_BASE}/services/${id}`, {
      method: "DELETE",
    });

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("DELETE /api/services/[id] proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}