import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/server/session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    redirect("/");
  }

  return <>{children}</>;
}
