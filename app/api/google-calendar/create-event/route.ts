import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';

export async function POST(request: Request) {
  const sessionInfo = await session();
  if (!sessionInfo?.token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, due_date } = body || {};

    if (!title || !due_date) {
      return NextResponse.json({ error: 'title and due_date are required' }, { status: 400 });
    }

    const accessToken = process.env.GCAL_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 });
    }

    // Create a simple all-day event on due_date
    const startDate = new Date(due_date).toISOString().slice(0, 10);
    const event = {
      summary: title,
      description: description || '',
      start: { date: startDate },
      end: { date: startDate },
    };

    const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: 'Google Calendar API error', detail: text }, { status: 502 });
    }

    const created = await resp.json();
    return NextResponse.json({ id: created.id, htmlLink: created.htmlLink });

  } catch (error) {
    console.error('Create event failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


