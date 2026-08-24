import { redirect } from "next/navigation";
import MiscFilesClient from "@/app/misc/MiscFilesClient";
import { getCurrentUser } from "@/lib/auth";
import {
  isBlobStorageConfigured,
  listMiscFiles,
  MAX_MISC_FILE_SIZE_BYTES,
} from "@/lib/misc-files";

export default async function MiscPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const files = await listMiscFiles(user.id);

  return (
    <MiscFilesClient
      initialFiles={files}
      maxFileSizeBytes={MAX_MISC_FILE_SIZE_BYTES}
      storageConfigured={isBlobStorageConfigured()}
    />
  );
}
