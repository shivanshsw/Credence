// app/api/invites/[id]/accept/route.ts
import { NextResponse } from "next/server";
import { session } from "@descope/nextjs-sdk/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// PATCH: accept invite and add user to group_members
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const inviteId = params.id;
    const sessionInfo = await session();
    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const descopeUserId = sessionInfo.token.sub;
        // find user in our users table
        const users = (await sql`SELECT id, email FROM users WHERE descope_user_id = ${descopeUserId}`) as { id: string; email: string }[];
        if (!users || users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const userId = users[0].id;
        const userEmail = users[0].email;

        // fetch invite
        const invites = (await sql`
      SELECT id, group_id, invited_user_email, role, status FROM invites WHERE id = ${inviteId}
    `) as { id: string; group_id: string; invited_user_email: string; role: string; status: string }[];

        if (!invites || invites.length === 0) {
            return NextResponse.json({ error: "Invite not found" }, { status: 404 });
        }

        const inv = invites[0];
        if (inv.status !== "pending") return NextResponse.json({ error: "Invite not pending" }, { status: 400 });

        // confirm email matches (optional but recommended)
        if (userEmail !== inv.invited_user_email) {
            return NextResponse.json({ error: "Invite email mismatch" }, { status: 403 });
        }

        // add to group_members (idempotent-ish: upsert or ignore if exists)
        await sql`
            INSERT INTO group_members (group_id, user_id, role, joined_at)
            VALUES (${inv.group_id}, ${userId}, ${inv.role}, now())
                ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role
        `;

        // mark invite accepted
        await sql`UPDATE invites SET status = 'accepted' WHERE id = ${inviteId}`;

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Failed to accept invite:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
