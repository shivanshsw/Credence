// app/api/invites/[id]/decline/route.ts
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
        const users = await sql`SELECT id, email FROM users WHERE descope_user_id = ${descopeUserId}` as {
            id: string;
            email?: string;
        }[];
        if (!users || users.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const userEmail = users[0].email;

        // fetch invite
        const invites = await sql`SELECT id, group_id, invited_user_email, role, status FROM invites WHERE id = ${inviteId}` as {
            id: string;
            group_id: string;
            invited_user_email: string;
            role: string;
            status: string;
        }[];

        if (!invites || invites.length === 0) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

        const invite = invites[0];
        if (invite.status !== "pending") return NextResponse.json({ error: "Invite is not pending" }, { status: 400 });

        // optional: only allow decline if the current user's email matches invited_user_email
        if (invite.invited_user_email && userEmail && invite.invited_user_email.toLowerCase() !== userEmail.toLowerCase()) {
            return NextResponse.json({ error: "Invite does not belong to this user" }, { status: 403 });
        }

        // mark invite declined
        await sql`UPDATE invites SET status = 'declined' WHERE id = ${inviteId}`;

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Failed to decline invite:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}