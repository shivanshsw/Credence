// app/api/invites/route.ts
import { NextResponse } from "next/server";
import { session } from "@descope/nextjs-sdk/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// GET: list invites for the logged-in user's email (or invites they created)
export async function GET() {
    const sessionInfo = await session();
    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const descopeUserId = sessionInfo.token.sub;
        // get user email
        const users = (await sql`SELECT id, email FROM users WHERE descope_user_id = ${descopeUserId}`) as { id: string; email: string }[];
        if (!users || users.length === 0) return NextResponse.json([], { status: 200 });

        const email = users[0].email;
        if (!email) return NextResponse.json([], { status: 200 });

        const rows = (await sql`
      SELECT i.id, i.group_id, g.name AS group_name, i.role, i.status
      FROM invites i
      JOIN groups g ON g.id = i.group_id
      WHERE i.invited_user_email = ${email} AND i.status = 'pending'
      ORDER BY i.created_at DESC
    `) as { id: string; group_id: string; group_name: string; role: string; status: string }[];

        return NextResponse.json(rows);
    } catch (err) {
        console.error("Failed to fetch invites:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST: create invites (body: { groupId, invites: [{ email, role }] })
export async function POST(req: Request) {
    const sessionInfo = await session();
    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { groupId, invites } = await req.json();
        if (!groupId || !Array.isArray(invites)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }
        const descopeUserId = sessionInfo.token.sub;
        const users = (await sql`SELECT id FROM users WHERE descope_user_id = ${descopeUserId}`) as { id: string }[];
        if (!users || users.length === 0) return NextResponse.json({ error: "Inviter not found" }, { status: 404 });
        const inviterId = users[0].id;

        for (const inv of invites) {
            if (!inv?.email || !inv?.role) continue;
            await sql`
                INSERT INTO invites (group_id, invited_by_user_id, invited_user_email, role, status, created_at)
                VALUES (${groupId}, ${inviterId}, ${inv.email}, ${inv.role}, 'pending', now())
            `;
        }

        return NextResponse.json({ ok: true }, { status: 201 });
    } catch (err) {
        console.error("Failed to create invites:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
