import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // must be service_role for private files
)

async function testDownload() {
    const { data, error } = await supabase
        .storage
        .from('mybucket')
        .download('docs/test.pdf')

    if (error) {
        console.error('❌ Error:', error.message)
        return
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    console.log('✅ File downloaded, size:', buffer.length, 'bytes')

    fs.writeFileSync('downloaded-test.pdf', buffer)
}

testDownload()
