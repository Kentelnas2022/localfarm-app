import { apiFetch } from "@/lib/api";

export interface HarvestReservation {
  id: number;
  reservation_code: string;
  post_id: number;
  seller_id: number;
  buyer_id: number;
  crop_name: string;
  quantity: number | string;
  unit: string;
  price_per_unit: number | string;
  total_estimated_amount: number | string;
  actual_weighed_quantity: number | string | null;
  final_settled_amount: number | string | null;
  harvest_date: string;
  pickup_location: string;
  status: 'pending' | 'confirmed' | 'ready_for_pickup' | 'completed' | 'cancelled';
  qr_token: string;
  buyer_notes?: string | null;
  seller_notes?: string | null;
  weighed_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  buyer_name?: string;
  buyer_username?: string;
  buyer_email?: string;
  buyer_phone?: string;
  buyer_avatar?: string;
  seller_name?: string;
  seller_username?: string;
  seller_email?: string;
  seller_phone?: string;
  seller_avatar?: string;
  farm_name?: string;
  farmer_code?: string;
}

export interface CreateReservationParams {
  postId: number | string;
  quantity: number;
  buyerNotes?: string;
}

export interface VerifyPickupParams {
  qrToken?: string;
  reservationCode?: string;
  actualWeighedQuantity?: number;
  sellerNotes?: string;
}

// 1. Fetch user reservations (as buyer, seller, or both)
export async function getMyReservationsApi(
  role: 'buyer' | 'seller' | 'all' = 'all',
  status: string = 'all',
  postId?: string | number
): Promise<{ success: boolean; reservations: HarvestReservation[] }> {
  const queryParams: Record<string, string> = { role, status };
  if (postId) {
    queryParams.postId = String(postId);
  }
  const query = new URLSearchParams(queryParams).toString();
  return apiFetch<{ success: boolean; reservations: HarvestReservation[] }>(
    `/reservations/my-reservations?${query}`
  );
}

// 2. Create advance pre-harvest reservation
export async function createReservationApi(
  params: CreateReservationParams
): Promise<{ success: boolean; message: string; reservation: HarvestReservation }> {
  return apiFetch<{ success: boolean; message: string; reservation: HarvestReservation }>(
    `/reservations`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );
}

// 3. Verify pickup & weigh-in
export async function verifyPickupApi(
  params: VerifyPickupParams
): Promise<{ success: boolean; message: string; receipt: HarvestReservation }> {
  return apiFetch<{ success: boolean; message: string; receipt: HarvestReservation }>(
    `/reservations/verify-pickup`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    }
  );
}

// 4. Update reservation status
export async function updateReservationStatusApi(
  id: number | string,
  status: 'confirmed' | 'ready_for_pickup' | 'cancelled',
  sellerNotes?: string
): Promise<{ success: boolean; message: string; reservation: HarvestReservation }> {
  return apiFetch<{ success: boolean; message: string; reservation: HarvestReservation }>(
    `/reservations/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, sellerNotes }),
    }
  );
}
