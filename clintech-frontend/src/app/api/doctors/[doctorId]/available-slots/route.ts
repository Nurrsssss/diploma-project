import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromCookies } from '@/utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const GATEWAY = (
  process.env.APPOINTMENTS_GATEWAY?.trim() ||
  process.env.GATEWAY?.trim() ||
  'http://185.125.46.62:8800'
).replace(/\/+$/, '');

const ALLOWED = new Set([
  'date',
  'start_time',
  'end_time',
  'appointment_type',
  'start_date',
  'end_date',
  'include_all',
  'include_booked',
  'include_cancelled',
  'all',
]);

function buildBackendUrl(doctorId: string, req: Request): string {
  const u = new URL(req.url);
  const backend = new URL(`${GATEWAY}/appointments/doctors/${encodeURIComponent(doctorId)}/available-slots`);

  for (const [k, v] of u.searchParams.entries()) {
    // alt_doctor_id — служебный параметр, его на backend не передаем
    if (k === 'alt_doctor_id') continue;
    if (ALLOWED.has(k) && v != null && v !== '') backend.searchParams.set(k, v);
  }

  return backend.toString();
}

/**
 * Надёжно достаём doctorId:
 * 1) пробуем ctx.params.doctorId
 * 2) fallback: /api/doctors/<doctorId>/available-slots
 */
function extractDoctorId(req: NextRequest, ctx: any): string | null {
  const fromParams = ctx?.params?.doctorId;
  if (typeof fromParams === 'string' && fromParams.trim() !== '') return fromParams.trim();

  const pathname = req.nextUrl?.pathname || new URL(req.url).pathname;
  const parts = pathname.split('/').filter(Boolean);
  const doctorsIdx = parts.indexOf('doctors');
  if (doctorsIdx >= 0 && parts.length > doctorsIdx + 1) {
    const id = parts[doctorsIdx + 1];
    if (id && id !== 'available-slots') return id;
  }
  return null;
}

function isStubOrEmptyAvailableSlots(payload: any): boolean {
  // payload обычно: { success, data: { schedule, slots, summary } }
  const data = payload?.data ?? payload ?? {};
  const scheduleId = String(data?.schedule?.id ?? '');
  const slots = data?.slots ?? data?.Slots;

  const isZeroSchedule = scheduleId === '00000000-0000-0000-0000-000000000000';

  // slots может быть null или []
  const isSlotsNull = slots === null || slots === undefined;
  const isSlotsEmptyArray = Array.isArray(slots) && slots.length === 0;

  // summary.total_slots может быть 0
  const total = Number(data?.summary?.total_slots ?? data?.summary?.totalSlots ?? NaN);
  const isTotalZero = Number.isFinite(total) ? total === 0 : false;

  return isZeroSchedule || isSlotsNull || isSlotsEmptyArray || isTotalZero;
}

async function fetchJsonWithTimeout(url: string, token: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (resp.status === 204) {
      return { status: 200, json: { success: true, data: { slots: [], summary: { total_slots: 0 } } } };
    }

    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await resp.text().catch(() => '');
      return {
        status: resp.status,
        json: text
          ? { success: false, error: 'Ответ сервера не JSON', details: text.slice(0, 500) }
          : { success: false, error: 'Пустой ответ сервера' },
      };
    }

    const data = await resp.json().catch(() => ({
      success: false,
      error: 'Некорректный JSON от сервера расписания',
    }));

    return { status: resp.status, json: data };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Таймаут запроса к серверу расписания (10s)');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest, ctx: any) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const doctorId = extractDoctorId(req, ctx);
    if (!doctorId) {
      return NextResponse.json(
        { error: 'ID врача обязателен' },
        { status: 400, headers: { 'x-debug-pathname': req.nextUrl?.pathname ?? '' } }
      );
    }

    const url1 = buildBackendUrl(doctorId, req);
    const r1 = await fetchJsonWithTimeout(url1, token);

    // Если всё ок — сразу отдаём
    if (r1.status >= 200 && r1.status < 300 && !isStubOrEmptyAvailableSlots(r1.json)) {
      return NextResponse.json(r1.json as any, {
        status: r1.status,
        headers: { 'x-doctor-id-used': doctorId },
      });
    }

    // Fallback: пробуем alt_doctor_id (обычно doctor_user_id)
    const altDoctorId = req.nextUrl.searchParams.get('alt_doctor_id')?.trim();
    if (altDoctorId && altDoctorId !== doctorId) {
      const url2 = buildBackendUrl(altDoctorId, req);
      const r2 = await fetchJsonWithTimeout(url2, token);

      if (r2.status >= 200 && r2.status < 300 && !isStubOrEmptyAvailableSlots(r2.json)) {
        return NextResponse.json(r2.json as any, {
          status: r2.status,
          headers: { 'x-doctor-id-used': altDoctorId, 'x-doctor-id-fallback': doctorId },
        });
      }

      // если и второй пустой — вернем второй (чтобы видеть, что реально бэк отвечает)
      return NextResponse.json(r2.json as any, {
        status: r2.status,
        headers: { 'x-doctor-id-used': altDoctorId, 'x-doctor-id-fallback': doctorId, 'x-empty-result': '1' },
      });
    }

    // alt_doctor_id не дали — вернем первый ответ как есть
    return NextResponse.json(r1.json as any, {
      status: r1.status,
      headers: { 'x-doctor-id-used': doctorId, 'x-empty-result': isStubOrEmptyAvailableSlots(r1.json) ? '1' : '0' },
    });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : 'Внутренняя ошибка сервера';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
