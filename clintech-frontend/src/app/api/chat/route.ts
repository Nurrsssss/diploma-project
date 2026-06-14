import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    try {
        const response = await fetch(`${process.env.ANKETA_SERVICE}/questionnaire/template`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch questionnaire' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
