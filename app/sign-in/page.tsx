

"use client";

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';


const Descope = dynamic(
    () => import('@descope/nextjs-sdk').then((mod) => mod.Descope),
    { ssr: false }
);

export default function SignInPage() {
    const router = useRouter();

    return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-950">
            <Descope
                flowId="sign-up-or-in" // This is the default flow from your Descope console
                onSuccess={(e: any) => {
                    console.log('Successfully logged in!', e.detail.user);
                    // After a successful login, redirect the user to the main page
                    router.push('/');
                    router.refresh(); // Refresh to ensure server components update
                }}
                onError={(e: any) => {
                    console.error('Login failed!', e);
                }}
                theme="dark" // Use dark theme to match your app's aesthetic
            />
        </div>
    );
};