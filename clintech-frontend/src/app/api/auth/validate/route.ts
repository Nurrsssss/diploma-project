import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("auth_token")?.value; // ✅ прямое чтение cookie

    if (!token) {
      return NextResponse.json({ error: "Токен не найден" }, { status: 401 });
    }

    const gateway = process.env.GATEWAY;
    if (!gateway) {
      return NextResponse.json({ error: "GATEWAY env is missing" }, { status: 500 });
    }

    const backendRes = await fetch(`${gateway}/auth/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`, // ✅ вот это MUST
      },
    });

    const data = await backendRes.json().catch(() => ({
      error: "Некорректный ответ от сервера",
    }));

    return NextResponse.json(data, { status: backendRes.status });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Ошибка сервера" },
      { status: 500 }
    );
  }
}
