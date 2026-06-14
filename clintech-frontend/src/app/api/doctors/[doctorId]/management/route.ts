import { cookies } from 'next/headers';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ doctorId: string }> }
) {
  try {
    const { doctorId } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    const res = await fetch(`${process.env.GATEWAY}/doctors/${doctorId}/management`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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