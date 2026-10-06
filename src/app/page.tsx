import { appMode } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { WorkspaceApp } from "@/components/workspace-app";
import { Login } from "@/components/login";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentUser();
  return user ? (
    <WorkspaceApp user={user} mode={appMode()} />
  ) : (
    <Login mode={appMode()} />
  );
}
