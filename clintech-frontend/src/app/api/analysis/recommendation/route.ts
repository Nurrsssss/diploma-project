import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, addAuthHeaderToRequest } from '@/utils/auth';

function parseAnswers(raw: FormDataEntryValue | null): Record<string, string> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [
        key,
        value == null ? '' : Array.isArray(value) ? value.join(', ') : String(value),
      ]),
    );
  } catch {
    return {};
  }
}

function buildRecommendationText(
  answers: Record<string, string>,
  attachmentsCount: number,
): string {
  const complaints = answers.complaints?.trim();
  const duration = answers.symptoms_duration?.trim();
  const chronic = answers.chronic_diseases_presence?.trim();
  const medications = answers.medications?.trim();
  const allergies = answers.allergies?.trim();
  const stress = answers.stress?.trim();
  const sleep = answers.sleep?.trim();
  const activity = answers.physical_activity?.trim();
  const substances = answers.substances_use?.trim();

  const lines: string[] = [
    'Предварительные рекомендации сформированы автоматически на основе заполненной анкеты и не заменяют очную консультацию врача.',
  ];

  if (complaints) {
    lines.push(`Основная жалоба: ${complaints}.`);
  }
  if (duration) {
    lines.push(`Длительность симптомов: ${duration}.`);
  }
  if (chronic) {
    lines.push(`Важно сообщить врачу о хронических заболеваниях: ${chronic}.`);
  }
  if (medications) {
    lines.push(`Подготовьте список принимаемых препаратов: ${medications}.`);
  }
  if (allergies) {
    lines.push(`Обязательно сообщите об аллергиях: ${allergies}.`);
  }

  lines.push(
    'До консультации отслеживайте динамику симптомов: когда усиливаются, что облегчает состояние, есть ли новые проявления.',
  );

  if (stress) {
    lines.push(`Обратите внимание на уровень стресса: ${stress}. По возможности снизьте нагрузку и нормализуйте режим отдыха.`);
  }
  if (sleep) {
    lines.push(`Сон: ${sleep}. Старайтесь поддерживать регулярный режим сна.`);
  }
  if (activity) {
    lines.push(`Физическая активность: ${activity}. Избегайте перегрузок до уточнения диагноза.`);
  }
  if (substances) {
    lines.push(`Учитывайте влияние вредных привычек: ${substances}. По возможности ограничьте их до приема.`);
  }

  if (attachmentsCount > 0) {
    lines.push(`К анкете приложено файлов: ${attachmentsCount}. Возьмите эти материалы на прием и убедитесь, что врач их увидит.`);
  }

  lines.push(
    'Срочно обратитесь за неотложной помощью, если появятся выраженное ухудшение состояния, сильная боль, одышка, потеря сознания или другие острые симптомы.',
  );
  lines.push('Для уточнения причины состояния рекомендуется очная консультация специалиста.');

  return lines.map((line) => `- ${line}`).join('\n');
}

export async function POST(req: NextRequest) {
  // Check authentication
  const authError = await requireAuth(req);
  if (authError) return authError;

  try {
    const formData = await req.formData();

    // Get auth headers but don't include Content-Type for FormData
    const authHeaders = await addAuthHeaderToRequest(req);

    // Don't set Content-Type header - let fetch handle it for FormData
    const headers: Record<string, string> = {
      Authorization: authHeaders['Authorization'],
    };

    const anketaService = process.env.ANKETA_SERVICE;

    if (anketaService) {
      try {
        const ginResponse = await fetch(`${anketaService}/analysis/recommendation`, {
          method: 'POST',
          body: formData,
          headers,
        });

        if (ginResponse.ok) {
          const data = await ginResponse.json();
          return NextResponse.json(data);
        }

        const errorText = await ginResponse.text();
        console.error('Backend error:', errorText);
      } catch (backendError) {
        console.error('AI backend unavailable, using local fallback:', backendError);
      }
    }

    const answers = parseAnswers(formData.get('answers'));
    const attachmentsCount = formData.getAll('attachments').length;
    const recommendations = buildRecommendationText(answers, attachmentsCount);

    return NextResponse.json({
      success: true,
      analysis_id: crypto.randomUUID(),
      recommendations,
      fallback: true,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}