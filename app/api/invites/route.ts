// app/api/invites/route.ts
import { NextResponse } from "next/server";
import { session } from "@descope/nextjs-sdk/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

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
        const users = (await sql`SELECT id FROM users WHERE descope_user_id = ${descopeUserId}`) as { id: string }[];
        if (!users || users.length === 0) {
            return NextResponse.json({ error: "Inviter not found" }, { status: 404 });
        }
        const inviterId = users[0].id;

        // insert invites (one-by-one; could be batched)
        for (const inv of invites) {
            if (!inv?.email || !inv?.role) continue;
            await sql`
        INSERT INTO invites (group_id, invited_by_user_id, invited_user_email, role, status, created_at)
        VALUES (${groupId}, ${inviterId}, ${inv.email}, ${inv.role}, 'pending', now())
      `;
            // optionally, queue email notifications here
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Failed to create invites:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
