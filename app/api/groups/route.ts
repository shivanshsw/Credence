import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { neon } from '@neondatabase/serverless';

// This initializes the Neon database client
const sql = neon(process.env.DATABASE_URL!);

// Define a type for our Group object for better type safety
interface Group {
    id: string;
    name: string;
    invite_code?: string;
}

// Function to generate a unique invite code
function generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// GET: Function to fetch all groups for the logged-in user
export async function GET() {
    const sessionInfo = await session();

    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const descopeUserId = sessionInfo.token.sub;
        console.log(`🔍 Fetching groups for user: ${descopeUserId}`);

        // First, let's check if the user exists in the database
        const userCheck = await sql`
            SELECT id, email, name FROM users WHERE descope_user_id = ${descopeUserId}
        `;
        console.log(`🔍 User check:`, userCheck);

        if (!userCheck || userCheck.length === 0) {
            console.log(`🔍 User not found in database`);
            return NextResponse.json([]);
        }

        const userId = userCheck[0].id;
        console.log(`🔍 User ID: ${userId}`);

        // Check group_members table for this user
        const memberships = await sql`
            SELECT gm.group_id, gm.user_id, gm.role, g.name as group_name
            FROM group_members gm
            JOIN groups g ON gm.group_id = g.id
            WHERE gm.user_id = ${userId}
        `;
        console.log(`🔍 Direct memberships query:`, memberships);

        // Find all groups where the current user is a member
        const groups = (await sql`
            SELECT g.id, g.name
            FROM groups g
                     JOIN group_members gm ON g.id = gm.group_id
                     JOIN users u ON gm.user_id = u.id
            WHERE u.descope_user_id = ${descopeUserId}
        `) as Group[];

        console.log(`🔍 Found groups:`, groups);
        return NextResponse.json(groups);
    } catch (error) {
        console.error('🔴 Failed to fetch groups:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// POST: Function to create a new group
export async function POST(request: Request) {
    const sessionInfo = await session();

    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { name } = await request.json();
        if (!name) {
            return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
        }

        const descopeUserId = sessionInfo.token.sub;

        // --- CORRECTED SEQUENTIAL LOGIC ---

        // 1. Get our application's internal user ID
        const users = (await sql`
            SELECT id FROM users WHERE descope_user_id = ${descopeUserId}
        `) as { id: string }[];

        if (!users || users.length === 0) {
            throw new Error('User not found in database. Sync might not have completed.');
        }
        const userId = users[0].id;

        // 2. Generate a unique invite code
        let inviteCode: string = '';
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
            inviteCode = generateInviteCode();
            const existingCode = await sql`
                SELECT id FROM groups WHERE invite_code = ${inviteCode}
            `;
            if (existingCode.length === 0) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique || !inviteCode) {
            throw new Error('Failed to generate unique invite code');
        }

        // 3. Create the new group with invite code and return its details
        let createdGroups: Group[];
        try {
            createdGroups = (await sql`
                INSERT INTO groups (name, created_by, invite_code) VALUES (${name}, ${userId}, ${inviteCode}) RETURNING id, name, invite_code
            `) as Group[];
        } catch (error) {
            // If invite_code column doesn't exist, try without it
            if (error instanceof Error && error.message.includes('column "invite_code" does not exist')) {
                console.warn('invite_code column not found, creating group without invite code');
                createdGroups = (await sql`
                    INSERT INTO groups (name, created_by) VALUES (${name}, ${userId}) RETURNING id, name
                `) as Group[];
                // Add empty invite_code to match interface
                createdGroups[0] = { ...createdGroups[0], invite_code: '' };
            } else {
                throw error;
            }
        }
        const newGroup = createdGroups[0];

        // 4. Add the creator as the first member of the new group with the 'admin' role
        await sql`
            INSERT INTO group_members (group_id, user_id, role) VALUES (${newGroup.id}, ${userId}, 'admin')
        `;

        // --- END OF LOGIC ---

        console.log(`✅ New group created: ${newGroup.name}`);
        return NextResponse.json(newGroup, { status: 201 });
    } catch (error) {
        console.error('🔴 Failed to create group:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ 
            error: 'Failed to create group', 
            details: errorMessage 
        }, { status: 500 });
    }
}

