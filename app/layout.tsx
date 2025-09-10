import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider as DescopeProvider } from '@descope/nextjs-sdk' // Renamed to avoid conflict
import { AuthProvider } from "@/components/auth-context" // Your custom provider
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
    title: "CREDENCE",
    description: "AI-powered productivity and security",
}

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode
}>) {
    return (
        // 1. Descope's provider is on the outside
        <DescopeProvider projectId="P31g20L0fHuSApft5KX1X7XcYOrz">
            <html lang="en" className="dark">
            <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
            {}
            <AuthProvider>
                <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
            </AuthProvider>
            <Analytics />
            </body>
            </html>
        </DescopeProvider>
    )
}
    
