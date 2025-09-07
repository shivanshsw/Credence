//app/api/auth/sync/route.ts

import { NextResponse } from "next/server";
import { session } from "@descope/nextjs-sdk/server";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);


const retryWithDelay = async <T,>(
    operation: () => Promise<T>,
    retries: number,
    delay: number
): Promise<T | null> => {
    try {
        const result = await operation();
        return result;
    } catch (error) {
        if (retries === 0) {
            throw error;
        }
        await new Promise(res => setTimeout(res, delay));
        return retryWithDelay(operation, retries - 1, delay * 2); // Exponential backoff
    }
};
// ======================= POST =======================
// This route should be for syncing the user to the database.
export async function POST() {
    const sessionInfo = await session();

    if (!sessionInfo?.token?.sub) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const descopeUserId = sessionInfo.token.sub;
        // Use session token data directly - more reliable than management API
        const email = sessionInfo.token.email || null;
        const name = sessionInfo.token.name || null;

        console.log(`🔄 Syncing user: ${name} (${email})`);

        // Check if user exists
        const existingUsers = await sql`
            SELECT descope_user_id, email, name, username FROM users WHERE descope_user_id = ${descopeUserId}
        `;

        if (existingUsers.length === 0) {
            // derive unique username
            const base = (name || email || 'user').split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user';
            let username = base;
            let tries = 0;
            while (tries < 5) {
                const exists = await sql`SELECT 1 FROM users WHERE username = ${username} LIMIT 1`;
                if (!exists.length) break;
                username = base + Math.floor(1000 + Math.random() * 9000).toString();
                tries++;
            }
            await sql`
                INSERT INTO users (descope_user_id, email, name, username) VALUES (${descopeUserId}, ${email}, ${name}, ${username})
            `;
            console.log(`✅ New user created in database: ${name} (${email})`);
        } else {
            // Update the user's email or name if it has changed
            await sql`
                UPDATE users SET email = ${email}, name = ${name} WHERE descope_user_id = ${descopeUserId}
            `;
            console.log(`✅ User updated in database: ${name} (${email})`);
        }

        // Verify the user was created/updated correctly
        const verifyUsers = await sql`
            SELECT email, name FROM users WHERE descope_user_id = ${descopeUserId}
        `;
        console.log(`🔍 Verification - User in database:`, verifyUsers[0]);
        return NextResponse.json({
            success: true,
            message: "User synced successfully",
        });
    } catch (error) {
        console.error("🔴 Database sync error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}