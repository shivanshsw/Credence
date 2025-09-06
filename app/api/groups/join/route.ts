import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// Test database connection
if (!process.env.DATABASE_URL) {
    console.error('🔴 DATABASE_URL environment variable is not set');
}

export async function POST(request: Request) {
    console.log('🔍 Join group API called');
    
    try {
        // Parse request body
        const { invite_code } = await request.json();
        console.log(`🔍 Received invite_code: ${invite_code}`);
        
        if (!invite_code) {
            return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
        }

        // Get session
        const sessionInfo = await session();
        console.log('🔍 Session info:', sessionInfo);

        if (!sessionInfo?.token?.sub) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const descopeUserId = sessionInfo.token.sub;
        console.log(`🔍 User ID: ${descopeUserId}`);

        // Get user from database
        const users = await sql`
            SELECT id FROM users WHERE descope_user_id = ${descopeUserId}
        ` as { id: string }[];

        console.log(`🔍 Found users:`, users);

        if (!users || users.length === 0) {
            return NextResponse.json({ 
                error: 'User not found in database' 
            }, { status: 404 });
        }
        const userId = users[0].id;
        console.log(`🔍 Found user ID: ${userId}`);

        // Find group by invite code
        const groups = await sql`
            SELECT id, name FROM groups WHERE invite_code = ${invite_code}
        ` as { id: string; name: string }[];

        console.log(`🔍 Found groups:`, groups);

        if (!groups || groups.length === 0) {
            return NextResponse.json({ 
                error: 'Invalid invite code' 
            }, { status: 404 });
        }
        const group = groups[0];
        console.log(`🔍 Using group:`, group);

        // Check if already a member
        const existingMembership = await sql`
            SELECT group_id, user_id FROM group_members 
            WHERE group_id = ${group.id} AND user_id = ${userId}
        ` as { group_id: string; user_id: string }[];

        console.log(`🔍 Existing membership:`, existingMembership);

        if (existingMembership && existingMembership.length > 0) {
            return NextResponse.json({ 
                error: 'You are already a member of this group.' 
            }, { status: 400 });
        }

        // Add user to group
        console.log(`🔍 Adding user ${userId} to group ${group.id}`);
        const insertResult = await sql`
            INSERT INTO group_members (group_id, user_id, role, joined_at) 
            VALUES (${group.id}, ${userId}, 'member', NOW())
            RETURNING group_id, user_id, role, joined_at
        `;
        
        console.log(`✅ Insert result:`, insertResult);

        // Verify the insert worked
        const verifyMembership = await sql`
            SELECT gm.group_id, gm.user_id, gm.role, g.name as group_name
            FROM group_members gm
            JOIN groups g ON gm.group_id = g.id
            WHERE gm.group_id = ${group.id} AND gm.user_id = ${userId}
        `;
        
        console.log(`🔍 Verification - Membership in database:`, verifyMembership);

        console.log(`✅ User ${userId} joined group ${group.name}`);
        
        return NextResponse.json({ 
            success: true, 
            message: `Successfully joined group "${group.name}"`,
            group: {
                id: group.id,
                name: group.name
            }
        });

    } catch (error) {
        console.error('🔴 Join group error:', error);
        return NextResponse.json({ 
            error: 'Failed to join group', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        }, { status: 500 });
    }
}
