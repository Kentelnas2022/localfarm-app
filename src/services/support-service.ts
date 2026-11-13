import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../lib/api";

export type TicketCategory =
  | "App Glitch"
  | "Fake Produce Listing"
  | "Buyer No-Show"
  | "Payment Dispute"
  | "Harassment"
  | "RSBSA / Verification"
  | "Other";

export type TicketStatus =
  | "Under Review"
  | "Resolved"
  | "Received"
  | "Approved / Verified"
  | "Rejected";

export interface SupportTicket {
  id: string;
  category: TicketCategory | string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority?: "Normal" | "Urgent";
  relatedUserOrListing?: string;
  attachments?: string[];
  date: string;
  resolutionNotes?: string;
}

export const STORAGE_TICKETS_KEY = "localfarm_support_tickets_v1";

export const DEFAULT_TICKETS: SupportTicket[] = [
  {
    id: "LF-9021-INIT",
    category: "RSBSA / Verification",
    subject: "Welcome to Local Farm Support Desk",
    description:
      "Your grower help desk is active. You can report transaction disputes, submit farm verification inquiries, or track resolution progress directly in your Support Inbox.",
    status: "Resolved",
    priority: "Normal",
    date: "Sep 10, 2026",
    resolutionNotes:
      "Agricultural community guidelines and dispute resolution mechanisms are enabled for your account.",
  },
];

/**
 * Fetch all submitted support tickets dynamically from backend API with local cache
 */
export async function getSupportTicketsApi(): Promise<SupportTicket[]> {
  try {
    const res = await apiFetch<{ tickets: SupportTicket[] }>("/reports/my-tickets");
    if (res && Array.isArray(res.tickets) && res.tickets.length > 0) {
      await AsyncStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(res.tickets));
      return res.tickets;
    }
  } catch (err) {
    // Fall back to offline storage
  }

  try {
    const data = await AsyncStorage.getItem(STORAGE_TICKETS_KEY);
    if (data) {
      const parsed: SupportTicket[] = JSON.parse(data);
      return parsed;
    }
    await AsyncStorage.setItem(
      STORAGE_TICKETS_KEY,
      JSON.stringify(DEFAULT_TICKETS)
    );
    return DEFAULT_TICKETS;
  } catch (err) {
    console.warn("Failed to load support tickets:", err);
    return DEFAULT_TICKETS;
  }
}

/**
 * Create a new support ticket dynamically, persisting to MySQL database
 */
export async function createSupportTicketApi(
  ticketInput: Omit<SupportTicket, "id" | "date" | "status">
): Promise<SupportTicket> {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const newTicket: SupportTicket = {
    ...ticketInput,
    id: `LF-${Date.now().toString().slice(-4)}-${randomSuffix}`,
    status: "Under Review",
    date: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };

  // Cache locally first for instant optimistic response
  try {
    const current = await getSupportTicketsApi();
    const updated = [newTicket, ...current];
    await AsyncStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed to cache support ticket locally:", err);
  }

  // Persist to backend database
  try {
    await apiFetch("/reports", {
      method: "POST",
      body: JSON.stringify({
        reason: ticketInput.category,
        statement: `${ticketInput.subject}\n\n${ticketInput.description}`,
        severity: ticketInput.priority === "Urgent" ? "high" : "medium",
        attachmentUrl: ticketInput.attachments?.[0] || null,
      }),
    });
  } catch (err) {
    console.warn("Server report sync failed, ticket saved locally:", err);
  }

  return newTicket;
}

/**
 * Get a single ticket by its ID
 */
export async function getTicketByIdApi(
  id: string
): Promise<SupportTicket | null> {
  const tickets = await getSupportTicketsApi();
  return tickets.find((t) => t.id === id) || null;
}

/**
 * Compute support ticket statistics
 */
export async function getSupportStatsApi(): Promise<{
  total: number;
  pending: number;
  resolved: number;
}> {
  const tickets = await getSupportTicketsApi();
  const pending = tickets.filter(
    (t) => t.status === "Under Review" || t.status === "Received"
  ).length;
  const resolved = tickets.filter(
    (t) => t.status === "Resolved" || t.status === "Approved / Verified"
  ).length;
  return {
    total: tickets.length,
    pending,
    resolved,
  };
}

/**
 * Automatically create or update the RSBSA application ticket in the Support Inbox
 */
export async function syncRSBSASupportTicket(
  status: "Under Review" | "Approved / Verified" | "Rejected",
  app: {
    fullName: string;
    rsbsaNumber: string;
    farmName: string;
    location: string;
    crops: string;
    documentUri?: string;
  }
): Promise<SupportTicket> {
  try {
    const tickets = await getSupportTicketsApi();
    const existingIndex = tickets.findIndex(
      (t) =>
        t.category === "RSBSA / Verification" &&
        (t.id.startsWith("LF-RSBSA-") || t.subject.includes("RSBSA Verification") || t.subject.includes("RSBSA Application"))
    );

    const todayStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const resolutionNotes =
      status === "Approved / Verified"
        ? "Your RSBSA credentials have been verified by the Department of Agriculture and Local Farm Administration! The Green Verified Badge is now active on your profile and live streaming is unlocked."
        : status === "Rejected"
        ? "Your RSBSA verification could not be approved. Please review your certificate number and clear photo of your ID, then re-submit in the verification tab."
        : "Your RSBSA verification documents have been received and are currently under municipal agricultural review.";

    const ticketData: SupportTicket = {
      id: existingIndex >= 0 ? tickets[existingIndex].id : `LF-RSBSA-${Date.now().toString().slice(-4)}`,
      category: "RSBSA / Verification",
      subject: `RSBSA Verification: ${app.farmName || "Registered Farm"}`,
      description: `Official RSBSA Application submitted by ${app.fullName}.\n\n• Reference No: ${app.rsbsaNumber}\n• Farm Name: ${app.farmName}\n• Location: ${app.location}\n• Primary Produce: ${app.crops || "Various Produce"}\n\nStatus: ${status}`,
      status,
      priority: "Normal",
      attachments: app.documentUri ? [app.documentUri] : [],
      date: existingIndex >= 0 ? tickets[existingIndex].date : todayStr,
      resolutionNotes,
    };

    let updatedTickets: SupportTicket[];
    if (existingIndex >= 0) {
      updatedTickets = [...tickets];
      updatedTickets[existingIndex] = {
        ...updatedTickets[existingIndex],
        ...ticketData,
      };
    } else {
      updatedTickets = [ticketData, ...tickets];
    }

    await AsyncStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(updatedTickets));
    return ticketData;
  } catch (err) {
    console.warn("Failed to sync RSBSA support ticket:", err);
    throw err;
  }
}
