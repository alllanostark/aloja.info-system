import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { I18nProvider } from "@/lib/i18n";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <I18nProvider>
      <AppShell
        userName={profile.name ?? profile.email ?? "Utilizador"}
        userRole={profile.role}
      >
        {children}
      </AppShell>
    </I18nProvider>
  );
}
