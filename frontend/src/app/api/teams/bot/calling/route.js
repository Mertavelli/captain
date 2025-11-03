export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
    let body = {};
    try {
        body = await request.json();
    } catch {
        body = { error: 'Invalid JSON' };
    }

    console.log('CALLBACK EVENT:', JSON.stringify(body, null, 2));

    // Microsoft erwartet immer einen 200-OK-Response
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}

export async function GET() {
    return new Response(JSON.stringify({ ok: true, endpoint: 'calling' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}
