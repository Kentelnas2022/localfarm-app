import * as Device from "expo-device";
import { Platform } from "react-native";

export interface ClientDeviceInfo {
  deviceName: string;
  deviceType: "phone" | "tablet" | "desktop";
  osName: string;
  osVersion: string;
  browserOrApp: string;
}

/**
 * Helper to identify web browser from navigator.userAgent
 */
function getWebBrowserName(): string {
  if (typeof navigator === "undefined") return "Web Browser";
  const ua = navigator.userAgent;

  if (ua.includes("Firefox/")) return "Mozilla Firefox";
  if (ua.includes("Edg/")) return "Microsoft Edge";
  if (ua.includes("Chrome/")) return "Google Chrome";
  if (ua.includes("Safari/")) return "Apple Safari";
  if (ua.includes("MSIE") || ua.includes("Trident/")) return "Internet Explorer";

  return "Web Browser";
}

/**
 * Returns structured hardware and OS details for the current client device
 */
export async function getClientDeviceInfo(): Promise<ClientDeviceInfo> {
  const isWeb = Platform.OS === "web";

  let deviceType: "phone" | "tablet" | "desktop" = "phone";
  if (isWeb) {
    deviceType = "desktop";
  } else if (Device.deviceType === Device.DeviceType.TABLET) {
    deviceType = "tablet";
  } else if (Device.deviceType === Device.DeviceType.DESKTOP) {
    deviceType = "desktop";
  }

  let deviceName = "";
  if (isWeb) {
    const browser = getWebBrowserName();
    const os =
      typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")
        ? "Windows"
        : typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
        ? "macOS"
        : "Web";
    deviceName = `${browser} (${os})`;
  } else {
    const manufacturer = Device.manufacturer || "";
    const model = Device.modelName || Device.deviceName || "";

    if (manufacturer && model && !model.toLowerCase().includes(manufacturer.toLowerCase())) {
      deviceName = `${manufacturer} ${model}`.trim();
    } else {
      deviceName = model || manufacturer || "Mobile Device";
    }
  }

  const osName =
    (isWeb ? Platform.OS : Device.osName) || (Platform.OS === "ios" ? "iOS" : "Android");
  const osVersion = (isWeb ? "" : Device.osVersion) || "";
  const browserOrApp = isWeb ? getWebBrowserName() : "LocalFarm Mobile App";

  return {
    deviceName: deviceName || "LocalFarm Device",
    deviceType,
    osName,
    osVersion,
    browserOrApp,
  };
}
