import { redirect } from "next/navigation";
import MyPageClient from "@/app/mypage/MyPageClient";
import { getCurrentUser } from "@/lib/auth";
import { getDiscussionAccessStatus } from "@/lib/discussion-access";

export default async function MyPage({
  searchParams,
}: {
  searchParams?: Promise<{ discussion?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const discussionAccessStatus = await getDiscussionAccessStatus(user.id);

  return (
    <MyPageClient
      userName={user.name}
      userEmail={user.email}
      locked={params?.discussion === "locked"}
      initialStatus={discussionAccessStatus}
    />
  );
}
