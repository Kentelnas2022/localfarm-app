import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../lib/api";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface RSBSAApplication {
  fullName: string;
  rsbsaNumber: string;
  farmName: string;
  location: string;
  crops: string;
  documentUri?: string;
  status: VerificationStatus;
  submittedAt?: string;
  verifiedAt?: string;
}

const RSBSA_STORAGE_KEY = "localfarm_rsbsa_verification_v1";

export const DEFAULT_RSBSA_STATE: RSBSAApplication = {
  fullName: "",
  rsbsaNumber: "",
  farmName: "",
  location: "",
  crops: "",
  status: "unverified",
};

export async function getRSBSAApplication(): Promise<RSBSAApplication> {
  // First try to load from backend dynamically
  try {
    const res = await apiFetch<{ application: RSBSAApplication | null }>("/farmers/me/verification");
    if (res && res.application) {
      await AsyncStorage.setItem(RSBSA_STORAGE_KEY, JSON.stringify(res.application));
      return res.application;
    }
  } catch (err) {
    // Offline or network error: fall back to AsyncStorage
  }

  try {
    const data = await AsyncStorage.getItem(RSBSA_STORAGE_KEY);
    if (data !== null) {
      return JSON.parse(data);
    }
    return DEFAULT_RSBSA_STATE;
  } catch (err) {
    console.warn("Failed to load RSBSA application:", err);
    return DEFAULT_RSBSA_STATE;
  }
}

export async function submitRSBSAApplication(
  data: Omit<RSBSAApplication, "status" | "submittedAt">
): Promise<RSBSAApplication> {
  const newApp: RSBSAApplication = {
    ...data,
    status: "pending",
    submittedAt: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };

  // Cache locally first for instant optimistic response
  try {
    await AsyncStorage.setItem(RSBSA_STORAGE_KEY, JSON.stringify(newApp));
  } catch (err) {
    console.warn("Failed to cache RSBSA application locally:", err);
  }

  // Persist dynamically to backend & MySQL database
  try {
    const res = await apiFetch<{ application: RSBSAApplication }>("/farmers/apply-verification", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res && res.application) {
      await AsyncStorage.setItem(RSBSA_STORAGE_KEY, JSON.stringify(res.application));
      return res.application;
    }
  } catch (err) {
    console.warn("Remote RSBSA sync failed, saved locally:", err);
  }

  return newApp;
}

export async function setRSBSAStatus(
  status: VerificationStatus
): Promise<RSBSAApplication> {
  try {
    const current = await getRSBSAApplication();
    const updated: RSBSAApplication = {
      ...current,
      status,
      verifiedAt:
        status === "verified"
          ? new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : undefined,
    };
    await AsyncStorage.setItem(RSBSA_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.warn("Failed to update RSBSA status:", err);
    return DEFAULT_RSBSA_STATE;
  }
}

export async function resetRSBSAApplication(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RSBSA_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to reset RSBSA application:", err);
  }
}

