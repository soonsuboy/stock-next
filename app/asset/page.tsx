import { redirect } from "next/navigation";
import AssetManagerClient from "@/app/asset/AssetManagerClient";
import { getCurrentUser } from "@/lib/auth";
import { listAssetSnapshots } from "@/lib/assets";

export default async function AssetPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?callbackUrl=/asset");
  }

  const snapshots = await listAssetSnapshots(user.id);

  return <AssetManagerClient initialSnapshots={snapshots} />;
}
