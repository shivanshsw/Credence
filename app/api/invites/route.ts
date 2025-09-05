// app/api/invites/route.ts
import { NextResponse } from "next/server";
import { session } from "@descope/nextjs-sdk/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// GET: Fetch invites for the current logged-in user
export async function GET() {
    const sessionInfo = await session();
    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const descopeUserId = sessionInfo.token.sub;
        const email = sessionInfo.token.email; // Get email from session token directly

        if (!email) {
            return NextResponse.json({ error: "User email not found in session" }, { status: 400 });
        }

        console.log(`🔍 Fetching invites for email: ${email}`);

        // Find all pending invites for this user's email
        const invites = await sql`
            SELECT
                i.id,
                i.group_id,
                i.invited_user_email,
                i.role,
                i.status,
                i.created_at,
                g.name as group_name,
                u.name as invited_by_name,
                u.email as invited_by_email
            FROM invites i
                     JOIN groups g ON i.group_id = g.id
                     LEFT JOIN users u ON i.invited_by_user_id = u.id
            WHERE LOWER(i.invited_user_email) = LOWER(${email})
              AND i.status = 'pending'
            ORDER BY i.created_at DESC
        `;

        console.log(`✅ Found ${invites.length} pending invites`);
        return NextResponse.json(invites);
    } catch (err) {
        console.error("Failed to fetch invites:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST: Create new invites
export async function POST(req: Request) {
    const sessionInfo = await session();
    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { groupId, invites } = await req.json(); // invites: [{ email, role }, ...]
        if (!groupId || !Array.isArray(invites)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // find inviter user id
        const descopeUserId = sessionInfo.token.sub;
        const users = await sql`SELECT id FROM users WHERE descope_user_id = ${descopeUserId}` as { id: string }[];
        if (!users || users.length === 0) {
            return NextResponse.json({ error: "Inviter not found in database" }, { status: 404 });
        }
        const inviterId = users[0].id;

        console.log(`📨 Creating ${invites.length} invites for group ${groupId}`);

        // insert invites (one-by-one; could be batched)
        for (const inv of invites) {
            if (!inv?.email || !inv?.role) continue;
            await sql`
                INSERT INTO invites (group_id, invited_by_user_id, invited_user_email, role, status, created_at)
                VALUES (${groupId}, ${inviterId}, ${inv.email}, ${inv.role}, 'pending', now())
            `;
            console.log(`✅ Created invite for ${inv.email} with role ${inv.role}`);
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Failed to create invites:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}