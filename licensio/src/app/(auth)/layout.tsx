import Link from "next/link";
import { Logo } from "@/components/app/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-12">
      <Link href="/" className="mb-10">
        <Logo />
      </Link>
      {children}
    </div>
  );
}
