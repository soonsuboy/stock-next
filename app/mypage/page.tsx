import { redirect } from "next/navigation";
import MyPageClient from "@/app/mypage/MyPageClient";
import { getCurrentUser } from "@/lib/auth";

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

  return (
    <MyPageClient
      userName={user.name}
      userEmail={user.email}
      locked={params?.discussion === "locked"}
    />
  );
}
