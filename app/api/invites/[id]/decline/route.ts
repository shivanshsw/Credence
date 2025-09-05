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
        const userEmail = sessionInfo.token.email;

        if (!userEmail || typeof userEmail !== 'string') {
            return NextResponse.json({ error: "User email not found" }, { status: 400 });
        }

        // fetch invite and verify it belongs to this user
        const invites = await sql`
            SELECT id, group_id, invited_user_email, role, status
            FROM invites
            WHERE id = ${inviteId}
        ` as {
            id: string;
            group_id: string;
            invited_user_email: string;
            role: string;
            status: string;
        }[];

        if (!invites || invites.length === 0) {
            return NextResponse.json({ error: "Invite not found" }, { status: 404 });
        }

        const invite = invites[0];
        if (invite.status !== "pending") {
            return NextResponse.json({ error: "Invite is not pending" }, { status: 400 });
        }

        // verify this invite belongs to the current user
        if (invite.invited_user_email.toLowerCase() !== userEmail.toLowerCase()) {
            return NextResponse.json({ error: "Invite does not belong to this user" }, { status: 403 });
        }

        // mark invite declined
        await sql`UPDATE invites SET status = 'declined' WHERE id = ${inviteId}`;

        console.log(`❌ User declined invite ${inviteId}`);
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("Failed to decline invite:", err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}