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
    role: "FARMER" | "BUYER";
    walletAddress: string;
  }) =>
    request("/users/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getCrops: () => request("/crops"),

  getMyCrops: () => request("/crops/mine"),

  createCrop: (payload: {
    name: string;
    category: string;
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

  getAdminStats: () => request("/stats/admin"),

  getFarmerStats: () => request("/stats/farmer"),

  getBuyerStats: () => request("/stats/buyer"),
};
