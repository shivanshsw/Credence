//app/api/auth/sync/route.ts

import { NextResponse } from "next/server";
import { session } from "@descope/nextjs-sdk/server";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

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

        const client = await pool.connect();
        const { rows } = await client.query(
            "SELECT descope_user_id FROM users WHERE descope_user_id = $1",
            [descopeUserId]
        );

        if (rows.length === 0) {
            await client.query(
                "INSERT INTO users (descope_user_id, email, name) VALUES ($1, $2, $3)",
                [descopeUserId, email, name]
            );
            console.log(`✅ New user created in database: ${name}`);
        } else {
            // Update the user's email or name if it has changed
            await client.query(
                "UPDATE users SET email = $1, name = $2 WHERE descope_user_id = $3",
                [email, name, descopeUserId]
            );
            console.log(`✅ User updated in database: ${name}`);
        }

        client.release();
        return NextResponse.json({
            success: true,
            message: "User synced successfully",
        });
    } catch (error) {
        console.error("🔴 Database sync error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}