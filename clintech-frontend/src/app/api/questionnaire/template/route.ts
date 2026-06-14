import { NextRequest } from 'next/server';
import { questions as defaultQuestions } from '@/arrays/chat/questions';

export async function GET(req: NextRequest) {
  try {
    if (!process.env.ANKETA_SERVICE) {
      return new Response(JSON.stringify({ questions: defaultQuestions }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = `${process.env.ANKETA_SERVICE}/questionnaire/template`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ questions: defaultQuestions }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json().catch(() => ({ questions: defaultQuestions }));
    const safeData =
      data && typeof data === 'object' && Array.isArray(data.questions)
        ? data
        : { questions: defaultQuestions };

    return new Response(JSON.stringify(safeData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ questions: defaultQuestions }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}