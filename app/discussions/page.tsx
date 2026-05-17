import { redirect } from "next/navigation";
import DiscussionsClient from "@/app/discussions/DiscussionsClient";
import { isAdminEmail } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { getDiscussionAccessStatus } from "@/lib/discussion-access";

export default async function DiscussionsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const access = await getDiscussionAccessStatus(user.id);
  if (!access.hasAccess) {
    redirect("/mypage?discussion=locked");
  }

  return <DiscussionsClient canTriggerMetrics={isAdminEmail(user.email)} />;
}
