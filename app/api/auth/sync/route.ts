import { NextResponse } from 'next/server';
import { session } from '@descope/nextjs-sdk/server';
import { Pool } from 'pg';


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export async function POST() {

    const sessionInfo = await session();


    if (!sessionInfo || !sessionInfo.token?.sub) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const client = await pool.connect();


        const descopeUserId = sessionInfo.token.sub;
        const email = sessionInfo.token.email;
        const name = sessionInfo.token.name;


        const { rows } = await client.query(
            'SELECT descope_user_id FROM users WHERE descope_user_id = $1',
            [descopeUserId]
        );


        if (rows.length === 0) {
            await client.query(
                'INSERT INTO users (descope_user_id, email, name) VALUES ($1, $2, $3)',
                [descopeUserId, email, name]
            );
            console.log(`✅ New user created in database: ${name}`);
        } else {
            console.log(`✅ User already exists in database: ${name}`);
        }

        client.release();
        return NextResponse.json({ success: true, message: 'User synced successfully' });

    } catch (error) {
        console.error('🔴 Database sync error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

