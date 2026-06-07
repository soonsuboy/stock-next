import { redirect } from "next/navigation";
import AssetManagerClient from "@/app/asset/AssetManagerClient";
import { getAdminUser } from "@/lib/admin";
import { getAssetData } from "@/lib/assets";

export default async function AssetPage() {
  const user = await getAdminUser();
  if (!user) {
    redirect("/watchlist");
  }

  const assetData = await getAssetData(user.id);

  return <AssetManagerClient initialData={assetData} />;
}
