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
            SELECT descope_user_id, email, name FROM users WHERE descope_user_id = ${descopeUserId}
        `;

        if (existingUsers.length === 0) {
            await sql`
                INSERT INTO users (descope_user_id, email, name) VALUES (${descopeUserId}, ${email}, ${name})
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