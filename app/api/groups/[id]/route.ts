import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// GET: Fetch group details including invite code
export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const sessionInfo = await session();

    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await context.params;
        const groupId = id;
        const descopeUserId = sessionInfo.token.sub;

        // 1. Verify the user is a member of this group
        const userMembership = await sql`
            SELECT gm.role FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ${groupId} AND u.descope_user_id = ${descopeUserId}
        ` as { role: string }[];

        if (!userMembership || userMembership.length === 0) {
            return NextResponse.json({ 
                error: 'You are not a member of this group.' 
            }, { status: 403 });
        }

        // 2. Fetch group details including invite code
        const groups = await sql`
            SELECT id, name, invite_code, created_at
            FROM groups
            WHERE id = ${groupId}
        ` as { id: string; name: string; invite_code: string; created_at: string }[];

        if (!groups || groups.length === 0) {
            return NextResponse.json({ 
                error: 'Group not found.' 
            }, { status: 404 });
        }

        const group = groups[0];
        return NextResponse.json(group);

    } catch (error) {
        console.error('🔴 Failed to fetch group details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
