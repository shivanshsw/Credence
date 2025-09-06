import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface Member {
    id: string;
    name: string;
    email: string;
    role: string;
}

// GET: Fetch all members of a group
export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const sessionInfo = await session();

    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const groupId = params.id;
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

        // 2. Fetch all members of the group
        const members = await sql`
            SELECT 
                u.id,
                u.name,
                u.email,
                gm.role
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ${groupId}
            ORDER BY gm.role DESC, u.name ASC
        ` as Member[];

        return NextResponse.json({ members });

    } catch (error) {
        console.error('🔴 Failed to fetch group members:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// PATCH: Update a member's role
export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    const sessionInfo = await session();

    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const groupId = params.id;
        const descopeUserId = sessionInfo.token.sub;
        const { member_user_id, new_role } = await request.json();

        if (!member_user_id || !new_role) {
            return NextResponse.json({ 
                error: 'member_user_id and new_role are required' 
            }, { status: 400 });
        }

        // Validate role
        const validRoles = ['admin', 'manager', 'member'];
        if (!validRoles.includes(new_role)) {
            return NextResponse.json({ 
                error: 'Invalid role. Must be one of: admin, manager, member' 
            }, { status: 400 });
        }

        // 1. Verify the requesting user is an admin of this group
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

        if (userMembership[0].role !== 'admin') {
            return NextResponse.json({ 
                error: 'Only group admins can change member roles.' 
            }, { status: 403 });
        }

        // 2. Verify the target member exists in this group
        const targetMembership = await sql`
            SELECT gm.role FROM group_members gm
            WHERE gm.group_id = ${groupId} AND gm.user_id = ${member_user_id}
        ` as { role: string }[];

        if (!targetMembership || targetMembership.length === 0) {
            return NextResponse.json({ 
                error: 'Target user is not a member of this group.' 
            }, { status: 404 });
        }

        // 3. Update the member's role
        await sql`
            UPDATE group_members 
            SET role = ${new_role}
            WHERE group_id = ${groupId} AND user_id = ${member_user_id}
        `;

        console.log(`✅ Updated member ${member_user_id} role to ${new_role} in group ${groupId}`);
        
        return NextResponse.json({ 
            success: true, 
            message: 'Member role updated successfully' 
        });

    } catch (error) {
        console.error('🔴 Failed to update member role:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
