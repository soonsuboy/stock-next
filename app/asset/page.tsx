import { redirect } from "next/navigation";
import AssetManagerClient from "@/app/asset/AssetManagerClient";
import { getCurrentUser } from "@/lib/auth";
import { getAssetData } from "@/lib/assets";

export default async function AssetPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?callbackUrl=/asset");
  }

  const assetData = await getAssetData(user.id);

  return <AssetManagerClient initialData={assetData} />;
}
