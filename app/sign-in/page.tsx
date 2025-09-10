

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
                flowId="sign-up-or-in" // This is the default flow 
                onSuccess={(e: any) => {
                    console.log('Successfully logged in!', e.detail.user);
                    
                    router.push('/');
                    router.refresh(); 
                }}
                onError={(e: any) => {
                    console.error('Login failed!', e);
                }}
                theme="dark" 
            />
        </div>
    );
};