import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    const res = await fetch(`${process.env.GATEWAY}/doctors/reception`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      cache: 'no-store',
    });

    const text = await res.text();

    return new Response(text, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error: any) {
    return Response.json(
      {
        error: 'INTERNAL_ERROR',
        message: error?.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}