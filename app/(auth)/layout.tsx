import { AuthHeader } from "./_components/auth-header";
import { NetworkProvider } from "@/components/providers/network-provider";

export default function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <NetworkProvider>
      <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
        <AuthHeader />
        <main className="mx-auto flex w-full max-w-7xl flex-1 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </NetworkProvider>
  );
}
