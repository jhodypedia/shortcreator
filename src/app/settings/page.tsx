import { getAppSettings } from "@/lib/settings";
import { SettingsClient } from "@/components/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { publicSettings } = await getAppSettings();
  return <SettingsClient initialSettings={publicSettings} />;
}
