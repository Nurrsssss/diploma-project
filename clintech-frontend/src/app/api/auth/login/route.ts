import { NextResponse, NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function withMarker(res: NextResponse) {
  res.headers.set("x-login-route", "hit");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function getDataFromToken(token: string): { role: string; user_id: string } {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
    return {
      role: decoded.role || "",
      user_id: decoded.user_id || decoded.id || "",
    };
  } catch {
    return { role: "", user_id: "" };
  }
}

export async function POST(req: NextRequest) {
  const ts = new Date().toISOString();
  const ua = req.headers.get("user-agent") || "—";

  try {
    console.log("=== LOGIN HIT ===", ts, "UA=", ua);

    const body = await req.json();

    const gateway = process.env.GATEWAY;
    if (!gateway) {
      return withMarker(
        NextResponse.json({ error: "GATEWAY env is missing" }, { status: 500 })
      );
    }

    console.log("[LOGIN] GATEWAY =", gateway);
    console.log("[LOGIN] HTTP_PROXY =", process.env.HTTP_PROXY || process.env.http_proxy || "—");
    console.log("[LOGIN] HTTPS_PROXY =", process.env.HTTPS_PROXY || process.env.https_proxy || "—");
    console.log("[LOGIN] NO_PROXY =", process.env.NO_PROXY || process.env.no_proxy || "—");

    const target = `${gateway}/auth/login`;
    console.log("[LOGIN] target =", target);

    const backendRes = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const raw = await backendRes.text();

    console.log("[LOGIN] backend status =", backendRes.status, "raw length =", raw.length);
    console.log("[LOGIN] backend raw head =", raw.slice(0, 200));

    let data: any;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: "Non-JSON response from gateway", raw_head: raw.slice(0, 200) };
    }

    // Если gateway вернул ошибку или нет token — просто пробрасываем ответ
    if (!backendRes.ok || !data?.token) {
      return withMarker(NextResponse.json(data, { status: backendRes.status }));
    }

    const tokenData = getDataFromToken(data.token);

    const res = NextResponse.json(
      {
        success: true,
        role: tokenData.role,
        user_id: tokenData.user_id,
        message: "Успешный вход в систему",
      },
      { status: 200 }
    );

    // Cookie
    const isProd = process.env.NODE_ENV === "production";
    res.cookies.set("auth_token", data.token, {
      httpOnly: true,
      secure: isProd, // в проде true; на http localhost будет НЕ отправляться браузером
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return withMarker(res);
  } catch (e: any) {
    console.error("[LOGIN] ERROR", e);
    console.error("[LOGIN] ERROR cause", e?.cause);

    return withMarker(
      NextResponse.json(
        {
          error: e?.message || "Ошибка сервера",
          cause: e?.cause?.message || String(e?.cause || ""),
        },
        { status: 500 }
      )
    );
  }
}
