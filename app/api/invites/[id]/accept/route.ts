// app/api/invites/[id]/accept/route.ts
import { NextResponse } from "next/server";
import { session } from "@descope/nextjs-sdk/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const inviteId = params.id;
    const sessionInfo = await session();
    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // find current user in users table
        const descopeUserId = sessionInfo.token.sub;
        const users = (await sql`SELECT id, email FROM users WHERE descope_user_id = ${descopeUserId}`) as {
            id: string;
            email?: string;
        }[];
        if (!users || users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const userId = users[0].id;
        const userEmail = users[0].email;

        // fetch invite
        const invites = (await sql`SELECT id, group_id, invited_user_email, role, status FROM invites WHERE id = ${inviteId}`) as {
            id: string;
            group_id: string;
            invited_user_email: string;
            role: string;
            status: string;
        }[];

        if (!invites || invites.length === 0) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

        const invite = invites[0];
        if (invite.status === "accepted") return NextResponse.json({ error: "Invite already accepted" }, { status: 400 });

        // optional: only allow accept if the current user's email matches invited_user_email
        if (invite.invited_user_email && userEmail && invite.invited_user_email.toLowerCase() !== userEmail.toLowerCase()) {
            return NextResponse.json({ error: "Invite does not belong to this user" }, { status: 403 });
        }

        // add user to group_members with invited role (upsert to avoid duplicates)
        await sql`
      INSERT INTO group_members (group_id, user_id, role, joined_at)
      VALUES (${invite.group_id}, ${userId}, ${invite.role}, now())
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
