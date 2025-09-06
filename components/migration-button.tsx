"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, Loader2 } from "lucide-react"

export function MigrationButton() {
  const [migrating, setMigrating] = useState(false)
  const [migrated, setMigrated] = useState(false)

  const runMigration = async () => {
    try {
      setMigrating(true)
      
      // First run the database migration
      const migrationResponse = await fetch('/api/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!migrationResponse.ok) {
        const error = await migrationResponse.json()
        console.error('Migration failed:', error)
        alert('Migration failed: ' + (error.details || error.message))
        return
      }

      console.log('Database migration completed!')

      // Then test the Gemini API
      const geminiResponse = await fetch('/api/test-gemini', {
        method: 'GET',
      })

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json()
        console.log('Gemini API test:', geminiData)
        setMigrated(true)
        console.log('Migration and Gemini API test completed successfully!')
        // Refresh the page after migration
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        const error = await geminiResponse.json()
        console.error('Gemini API test failed:', error)
        alert('Database migrated but Gemini API test failed: ' + (error.error || error.message))
      }
    } catch (error) {
      console.error('Migration error:', error)
      alert('Migration failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setMigrating(false)
    }
  }

  if (migrated) {
    return (
      <div className="flex items-center gap-2 text-green-400">
        <Database className="h-4 w-4" />
        <span className="text-sm">Database migrated successfully!</span>
      </div>
    )
  }

  return (
    <Button
      onClick={runMigration}
      disabled={migrating}
      variant="outline"
      className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
    >
      {migrating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Migrating...
        </>
      ) : (
        <>
          <Database className="h-4 w-4 mr-2" />
          Run Database Migration
        </>
      )}
    </Button>
  )
}
