const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
}

export const api = {
  registerUser: (payload: {
    name: string;
    contact: string;
    location: string;
    pincode: string;
    latitude?: number;
    longitude?: number;
    role: "FARMER" | "BUYER";
    walletAddress: string;
  }) =>
    request("/users/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getCrops: (params?: {
    pincode?: string;
    availability?: "ACTIVE" | "ALL";
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.pincode) query.set("pincode", params.pincode);
    if (params?.availability) query.set("availability", params.availability);
    if (typeof params?.lat === "number") query.set("lat", String(params.lat));
    if (typeof params?.lng === "number") query.set("lng", String(params.lng));
    if (typeof params?.radiusKm === "number") query.set("radiusKm", String(params.radiusKm));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/crops${suffix}`);
  },

  getMyCrops: () => request("/crops/mine"),

  createCrop: (payload: {
    name: string;
    category: string;
    qualityGrade?: "A" | "B";
    quantity: string;
    quantityValue?: number;
    quantityUnit?: string;
    quantityBaseValue?: number;
    quantityBaseUnit?: string;
    unitScale?: number;
    priceEth: string;
    pricePerUnitEth?: string;
    pricePerUnitInr?: string;
    pricePerBaseUnitEth?: string;
    pricePerBaseUnitInr?: string;
    priceInr?: string;
    priceCurrency?: string;
    harvestDate: string;
    freshnessPeriodDays?: number;
    expiryDate: string;
    storageType: string;
    description: string;
    imageUrl?: string;
    imageUrls?: string[];
    certificateUrl?: string;
  }) =>
    request("/crops", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAdminCrops: () => request("/crops/admin/all"),

  updateCropStock: (id: string, payload: { quantityBaseValue?: number; quantityValue?: number }) =>
    request(`/crops/${id}/stock`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  removeExpiredCrop: (id: string) =>
    request(`/crops/${id}/expired`, {
      method: "DELETE",
    }),

  approveCrop: (id: string) =>
    request(`/crops/admin/${id}/approve`, {
      method: "POST",
    }),

  rejectCrop: (id: string) =>
    request(`/crops/admin/${id}/reject`, {
      method: "POST",
    }),

  getLedger: () => request("/ledger"),

  getContractMeta: () => request("/contract/meta"),

  getTransactions: () => request("/transactions"),

  assignCourier: (id: string, payload: { partnerName: string; contact?: string; trackingId?: string }) =>
    request(`/transactions/${id}/courier/assign`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  updateCourierStatus: (
    id: string,
    payload: {
      pickupStatus?: "PENDING" | "PICKED_UP";
      transitStatus?: "PENDING" | "IN_TRANSIT" | "DELIVERED";
    }
  ) =>
    request(`/transactions/${id}/courier/status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  requestReturn: (id: string, reason: string) =>
    request(`/transactions/${id}/return/request`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    }),

  reviewReturn: (id: string, decision: "APPROVED" | "REJECTED" | "COMPLETED") =>
    request(`/transactions/${id}/return/review`, {
      method: "PATCH",
      body: JSON.stringify({ decision }),
    }),

  rateOrder: (id: string, payload: { score: number; feedback?: string }) =>
    request(`/transactions/${id}/rating`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  getAdminTransactions: () => request("/transactions/admin"),

  getAddresses: () => request("/users/addresses"),

  createAddress: (payload: {
    label?: string;
    recipientName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    isDefault?: boolean;
  }) =>
    request("/users/addresses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  setDefaultAddress: (id: string) =>
    request(`/users/addresses/${id}/default`, {
      method: "PATCH",
    }),

  updateAddress: (
    id: string,
    payload: {
      label?: string;
      recipientName: string;
      phone: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postalCode: string;
      country?: string;
      isDefault?: boolean;
    }
  ) =>
    request(`/users/addresses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteAddress: (id: string) =>
    request(`/users/addresses/${id}`, {
      method: "DELETE",
    }),

  createTransactionIntent: (payload: {
    txHash: string;
    cropId: string;
    valueEth: string;
    units?: number;
    shippingAddressId?: string;
  }) =>
    request("/transactions/intent", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateFulfillmentStatus: (id: string, status: "PENDING" | "SHIPPED" | "DELIVERED") =>
    request(`/transactions/${id}/fulfillment`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getAdminUsers: () => request("/users/admin"),

  approveUser: (id: string) =>
    request(`/users/admin/${id}/approve`, {
      method: "POST",
    }),

  rejectUser: (id: string) =>
    request(`/users/admin/${id}/reject`, {
      method: "POST",
    }),

  suspendUser: (id: string) =>
    request(`/users/admin/${id}/suspend`, {
      method: "POST",
    }),

  getNonce: (wallet: string) => request(`/auth/nonce?wallet=${encodeURIComponent(wallet)}`),

  verifySignature: (wallet: string, signature: string) =>
    request("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ wallet, signature }),
    }),

  adminLogin: (payload: { username: string; password: string }) =>
    request("/auth/admin", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getEthInrRate: () => request("/rates/eth-inr"),

  uploadFile: async (file: File) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API_URL}/uploads`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error.error || "Upload failed");
    }

    return res.json();
  },

  getMarketplaceStats: () => request("/stats/marketplace"),
  getMarketplaceWasteInsights: () => request("/stats/marketplace/waste"),

  getAdminStats: () => request("/stats/admin"),

  getFarmerStats: () => request("/stats/farmer"),
  getFarmerWasteInsights: () => request("/stats/farmer/waste"),

  getBuyerStats: () => request("/stats/buyer"),

  getFarmerTrustStats: () => request("/stats/farmer/trust"),
  getFarmerTrustByWallet: (wallet: string) => request(`/stats/trust/farmer/${wallet}`),
  getWasteDatasets: () => request("/stats/waste/datasets"),
  getNearbyFarmers: (params?: { lat?: number; lng?: number; radiusKm?: number; category?: string; pincode?: string }) => {
    const query = new URLSearchParams();
    if (typeof params?.lat === "number") query.set("lat", String(params.lat));
    if (typeof params?.lng === "number") query.set("lng", String(params.lng));
    if (typeof params?.radiusKm === "number") query.set("radiusKm", String(params.radiusKm));
    if (params?.category) query.set("category", params.category);
    if (params?.pincode) query.set("pincode", params.pincode);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/users/farmers/near${suffix}`);
  },
  getFarmerResources: (category?: string) =>
    request(`/resources/farmer${category ? `?category=${encodeURIComponent(category)}` : ""}`),

  askAgriChatbot: (payload: {
    message: string;
    language?: "auto" | "en" | "ta";
    farmContext?: {
      soilType?: string;
      district?: string;
      season?: string;
      cropName?: string;
    };
  }) =>
    request("/agri-intelligence/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  assessCropHealth: async (payload: {
    image?: File;
    cropName?: string;
    symptoms?: string;
    language?: "auto" | "en" | "ta";
  }) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const form = new FormData();
    if (payload.image) {
      form.append("image", payload.image);
    }
    if (payload.cropName) {
      form.append("cropName", payload.cropName);
    }
    if (payload.symptoms) {
      form.append("symptoms", payload.symptoms);
    }
    if (payload.language) {
      form.append("language", payload.language);
    }

    const res = await fetch(`${API_URL}/agri-intelligence/crop-health`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Crop health request failed" }));
      throw new Error(error.error || "Crop health request failed");
    }

    return res.json();
  },

  getMarketPriceForecast: (params: { crop?: string; days?: number; language?: "en" | "ta" }) => {
    const query = new URLSearchParams();
    if (params.crop) query.set("crop", params.crop);
    if (typeof params.days === "number") query.set("days", String(params.days));
    if (params.language) query.set("language", params.language);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/agri-intelligence/market-forecast${suffix}`);
  },
};
