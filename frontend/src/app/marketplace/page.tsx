"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "@phosphor-icons/react";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { getContract } from "@/lib/contract";
import { ethers } from "ethers";
import { resolveAssetUrl } from "@/lib/format";
import { formatQuantityValue, getUnitMeta, parseToBaseUnits, stepForScale } from "@/lib/units";

export default function MarketplacePage() {
  const [listings, setListings] = useState<any[]>([]);
  const [action, setAction] = useState<{ id: string | null; status: string; error: string }>({
    id: null,
    status: "",
    error: "",
  });
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cartAction, setCartAction] = useState<{ busy: boolean; status: string; error: string }>({
    busy: false,
    status: "",
    error: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [unitFilter, setUnitFilter] = useState("All");
  const [sortBy, setSortBy] = useState("recent");
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressMode, setAddressMode] = useState<"select" | "new" | "edit">("select");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressSaving, setAddressSaving] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    label: "Primary",
    recipientName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    isDefault: true,
  });
  const [pendingAction, setPendingAction] = useState<null | { type: "cart" } | { type: "buy"; crop: any }>(
    null
  );

  const getCropId = (crop: any) => crop?._id || crop?.id;
  const getUnitScale = (crop: any) => {
    const scale = Number(crop?.unitScale);
    if (Number.isFinite(scale) && scale > 0) {
      return Math.floor(scale);
    }
    return getUnitMeta(crop?.quantityUnit || "").scale;
  };

  const getAvailableBaseUnits = (crop: any) => {
    const rawBase = crop?.quantityBaseValue;
    if (rawBase !== null && rawBase !== undefined && rawBase !== "") {
      const baseValue = Number(rawBase);
      if (Number.isFinite(baseValue) && baseValue >= 0) {
        return Math.floor(baseValue);
      }
    }
    const scale = getUnitScale(crop);
    const fromValue = Number(crop?.quantityValue);
    if (Number.isFinite(fromValue) && fromValue > 0) {
      const parsed = parseToBaseUnits(String(fromValue), scale, crop?.quantityUnit || "unit");
      if (Number.isFinite(parsed.base)) {
        return parsed.base as number;
      }
    }
    const match = String(crop?.quantity || "").match(/[\d.]+/);
    if (!match) return 0;
    const parsed = parseToBaseUnits(match[0], scale, crop?.quantityUnit || "unit");
    if (Number.isFinite(parsed.base)) {
      return parsed.base as number;
    }
    return 0;
  };

  const getPerBaseWei = (crop: any, availableBase: number, scale: number) => {
    if (crop?.pricePerBaseUnitEth) {
      try {
        return ethers.parseEther(String(crop.pricePerBaseUnitEth));
      } catch {
        return 0n;
      }
    }
    if (crop?.pricePerUnitEth && scale > 0) {
      try {
        const perUnit = ethers.parseEther(String(crop.pricePerUnitEth));
        return perUnit / BigInt(scale);
      } catch {
        return 0n;
      }
    }
    if (crop?.priceEth && availableBase > 0) {
      try {
        const total = ethers.parseEther(String(crop.priceEth));
        return total / BigInt(availableBase);
      } catch {
        return 0n;
      }
    }
    return 0n;
  };

  const buildCartItem = (crop: any) => {
    const unitScale = getUnitScale(crop);
    const unitMeta = getUnitMeta(crop?.quantityUnit || "");
    const baseUnit = crop?.quantityBaseUnit || unitMeta.baseUnit;
    const availableBase = getAvailableBaseUnits(crop);
    const availableDisplay = unitScale > 0 ? availableBase / unitScale : availableBase;
    const perBaseWei = getPerBaseWei(crop, availableBase, unitScale);
    const perUnitEth = perBaseWei > 0n ? ethers.formatEther(perBaseWei * BigInt(unitScale)) : "0";
    let perUnitInr = 0;
    if (Number(crop?.pricePerUnitInr) > 0) {
      perUnitInr = Number(crop.pricePerUnitInr);
    } else if (Number(crop?.pricePerBaseUnitInr) > 0) {
      perUnitInr = Number(crop.pricePerBaseUnitInr) * unitScale;
    }
    const defaultDisplay = availableDisplay > 0 ? (availableDisplay >= 1 ? 1 : availableDisplay) : 0;
    const defaultDisplayLabel = availableDisplay > 0 ? formatQuantityValue(defaultDisplay) : "0";
    const parsedDefault = parseToBaseUnits(defaultDisplayLabel, unitScale, crop?.quantityUnit || "unit");
    const defaultBase = Number.isFinite(parsedDefault.base) ? (parsedDefault.base as number) : 0;

    return {
      id: getCropId(crop),
      name: crop.name,
      category: crop.category,
      priceEth: crop.priceEth || String(crop.price || "").replace(" ETH", ""),
      priceInr: crop.priceInr,
      pricePerUnitEth: perUnitEth,
      pricePerUnitInr: perUnitInr,
      pricePerBaseWei: perBaseWei.toString(),
      quantity: crop.quantity,
      quantityUnit: crop.quantityUnit,
      unitScale,
      baseUnit,
      availableBase,
      availableDisplay,
      unitsDisplay: defaultDisplayLabel,
      unitsBase: defaultBase,
      outOfStock: availableBase === 0 || crop.status === "SOLD" || crop.status === "EXPIRED",
      pendingOnchain: !crop.contractCropId,
      farmerWallet: crop.farmerWallet,
      contractCropId: crop.contractCropId,
      imageUrl:
        (Array.isArray(crop.imageUrls) && crop.imageUrls[0]) || crop.imageUrl || "",
      expiryDate: crop.expiryDate,
    };
  };

  const formatEthFromWei = (value: bigint, decimals = 6) => {
    const eth = Number(ethers.formatEther(value));
    if (!Number.isFinite(eth)) {
      return ethers.formatEther(value);
    }
    return eth.toFixed(decimals);
  };

  const getListingMetrics = (crop: any) => {
    const unitScale = getUnitScale(crop);
    const availableBase = getAvailableBaseUnits(crop);
    const availableDisplay = unitScale > 0 ? availableBase / unitScale : availableBase;
    const perBaseWei = getPerBaseWei(crop, availableBase || 1, unitScale);
    const perUnitEth =
      perBaseWei > 0n ? Number(ethers.formatEther(perBaseWei * BigInt(unitScale))) : 0;
    let perUnitInr = 0;
    if (Number(crop?.pricePerUnitInr) > 0) {
      perUnitInr = Number(crop.pricePerUnitInr);
    } else if (Number(crop?.pricePerBaseUnitInr) > 0) {
      perUnitInr = Number(crop.pricePerBaseUnitInr) * unitScale;
    }
    return { unitScale, availableBase, availableDisplay, perBaseWei, perUnitEth, perUnitInr };
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((crop) => {
      if (crop?.category) {
        set.add(crop.category);
      }
    });
    return Array.from(set);
  }, [listings]);

  const units = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((crop) => {
      if (crop?.quantityUnit) {
        set.add(crop.quantityUnit);
      }
    });
    return Array.from(set);
  }, [listings]);

  const filteredListings = useMemo(() => {
    let data = listings.slice();
    if (searchTerm.trim()) {
      const search = searchTerm.trim().toLowerCase();
      data = data.filter((crop) => {
        const name = String(crop?.name || "").toLowerCase();
        const category = String(crop?.category || "").toLowerCase();
        return name.includes(search) || category.includes(search);
      });
    }
    if (categoryFilter !== "All") {
      data = data.filter((crop) => crop?.category === categoryFilter);
    }
    if (unitFilter !== "All") {
      data = data.filter((crop) => crop?.quantityUnit === unitFilter);
    }

    data.sort((a, b) => {
      if (sortBy === "price_low" || sortBy === "price_high") {
        const priceA = getListingMetrics(a).perUnitEth;
        const priceB = getListingMetrics(b).perUnitEth;
        if (!priceA && !priceB) return 0;
        if (!priceA) return 1;
        if (!priceB) return -1;
        return sortBy === "price_low" ? priceA - priceB : priceB - priceA;
      }
      if (sortBy === "expiry") {
        const expA = a?.expiryDate ? new Date(a.expiryDate).getTime() : 0;
        const expB = b?.expiryDate ? new Date(b.expiryDate).getTime() : 0;
        return expA - expB;
      }
      const timeA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return data;
  }, [listings, searchTerm, categoryFilter, unitFilter, sortBy]);

  const cartIds = useMemo(() => new Set(cartItems.map((item) => item.id)), [cartItems]);
  const cartSummary = useMemo(() => {
    const inStockItems = cartItems.filter(
      (item) =>
        !item.pendingOnchain &&
        !item.outOfStock &&
        Number(item.availableBase) > 0 &&
        Number(item.unitsBase) > 0
    );
    const farmerSet = new Set(inStockItems.map((item) => item.farmerWallet).filter(Boolean));
    const pendingItems = cartItems.filter((item) => item.pendingOnchain);
    const totalWei = inStockItems.reduce((total: bigint, item) => {
      const perBaseWei = item.pricePerBaseWei ? BigInt(item.pricePerBaseWei) : 0n;
      const unitsBase = Number(item.unitsBase) > 0 ? BigInt(item.unitsBase) : 0n;
      return total + perBaseWei * unitsBase;
    }, 0n);
    const totalInr = inStockItems.reduce((total: number, item) => {
      const perUnitInr = Number(item.pricePerUnitInr);
      const unitsDisplay = Number(item.unitsDisplay);
      if (!Number.isFinite(perUnitInr) || perUnitInr <= 0) return total;
      if (!Number.isFinite(unitsDisplay) || unitsDisplay <= 0) return total;
      return total + perUnitInr * unitsDisplay;
    }, 0);
    return {
      inStockItems,
      hasMultipleFarmers: farmerSet.size > 1,
      farmer: farmerSet.size === 1 ? Array.from(farmerSet)[0] : null,
      totalWei,
      totalEth: formatEthFromWei(totalWei, 6),
      totalInr,
      hasOutOfStock: cartItems.some((item) => item.outOfStock || item.availableBase === 0),
      hasPending: pendingItems.length > 0,
    };
  }, [cartItems]);

  useEffect(() => {
    const fetchListings = () => {
      api
        .getCrops()
        .then((data) => {
          if (Array.isArray(data)) {
            setListings(data);
          }
        })
        .catch(() => {
          // leave empty on error
        });
    };

    fetchListings();
    const interval = setInterval(() => {
      fetchListings();
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setAddressLoading(true);
    api
      .getAddresses()
      .then((data) => {
        if (Array.isArray(data)) {
          setAddresses(data);
          const defaultAddress = data.find((addr) => addr.isDefault) || data[0];
          if (defaultAddress) {
            setSelectedAddressId(String(defaultAddress._id));
          }
          setAddressMode(data.length > 0 ? "select" : "new");
        }
      })
      .catch(() => {
        setAddresses([]);
        setAddressMode("new");
      })
      .finally(() => {
        setAddressLoading(false);
      });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("marketplace_cart");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCartItems(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("marketplace_cart", JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (listings.length === 0) return;
    setCartItems((prev) => {
      const byId = new Map(listings.map((crop) => [getCropId(crop), crop]));
      return prev.map((item) => {
        const latest = byId.get(item.id);
        if (!latest) {
          return { ...item, outOfStock: true, availableBase: 0, availableDisplay: 0 };
        }
        const rebuilt = buildCartItem(latest);
        const parsed = parseToBaseUnits(
          String(item.unitsDisplay || ""),
          rebuilt.unitScale,
          rebuilt.quantityUnit || "unit"
        );
        let nextBase = Number.isFinite(parsed.base) ? (parsed.base as number) : rebuilt.unitsBase;
        if (nextBase > rebuilt.availableBase) {
          nextBase = rebuilt.availableBase;
        }
        if (nextBase < 1 && rebuilt.availableBase > 0) {
          nextBase = 1;
        }
        const nextDisplay =
          nextBase > 0 ? formatQuantityValue(nextBase / rebuilt.unitScale) : "0";
        return {
          ...item,
          ...rebuilt,
          unitsBase: rebuilt.availableBase > 0 ? nextBase : 0,
          unitsDisplay: nextDisplay,
          outOfStock: rebuilt.outOfStock || rebuilt.availableBase === 0,
        };
      });
    });
  }, [listings]);

  const addToCart = (crop: any) => {
    const id = getCropId(crop);
    if (!id) return;
    const availableBase = getAvailableBaseUnits(crop);
    if (availableBase <= 0 || crop.status === "SOLD" || crop.status === "EXPIRED") {
      setCartAction({ busy: false, status: "", error: "Listing is out of stock." });
      return;
    }
    if (cartIds.has(id)) {
      return;
    }
    const item = buildCartItem(crop);
    setCartItems((prev) => [...prev, item]);
    if (item.pendingOnchain) {
      setCartAction({
        busy: false,
        status: "Added to cart. Awaiting on-chain listing approval.",
        error: "",
      });
    }
  };

  const updateCartUnits = (id: string, value: string) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (Number(item.availableBase) <= 0) {
          return { ...item, unitsDisplay: value, unitsBase: 0 };
        }
        const parsed = parseToBaseUnits(value, item.unitScale, item.quantityUnit || "unit");
        if (!Number.isFinite(parsed.base)) {
          return { ...item, unitsDisplay: value };
        }
        let nextBase = parsed.base as number;
        if (nextBase > item.availableBase) {
          nextBase = item.availableBase;
        }
        if (nextBase < 1) {
          nextBase = 1;
        }
        const nextDisplay = formatQuantityValue(nextBase / item.unitScale);
        return { ...item, unitsBase: nextBase, unitsDisplay: nextDisplay };
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const openAddressFlow = (action: { type: "cart" } | { type: "buy"; crop: any }) => {
    setPendingAction(action);
    setAddressError("");
    if (addresses.length === 0) {
      setAddressMode("new");
    } else {
      setAddressMode("select");
    }
    setAddressModalOpen(true);
  };

  const resetAddressForm = () => {
    setAddressForm({
      label: "Primary",
      recipientName: "",
      phone: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "India",
      isDefault: true,
    });
    setEditingAddressId(null);
  };

  const openNewAddress = () => {
    resetAddressForm();
    setAddressMode("new");
  };

  const openEditAddress = (address: any) => {
    setEditingAddressId(String(address._id));
    setAddressForm({
      label: address.label || "Primary",
      recipientName: address.recipientName || "",
      phone: address.phone || "",
      line1: address.line1 || "",
      line2: address.line2 || "",
      city: address.city || "",
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "India",
      isDefault: Boolean(address.isDefault),
    });
    setAddressMode("edit");
  };

  const handleAddressSave = async () => {
    setAddressSaving(true);
    setAddressError("");
    try {
      const payload = {
        label: addressForm.label || "Primary",
        recipientName: addressForm.recipientName,
        phone: addressForm.phone,
        line1: addressForm.line1,
        line2: addressForm.line2,
        city: addressForm.city,
        state: addressForm.state,
        postalCode: addressForm.postalCode,
        country: addressForm.country || "India",
        isDefault: addressForm.isDefault,
      };
      const data = await api.createAddress(payload);
      if (Array.isArray(data)) {
        setAddresses(data);
        const newDefault = data.find((addr) => addr.isDefault) || data[data.length - 1];
        if (newDefault) {
          setSelectedAddressId(String(newDefault._id));
        }
        setAddressMode("select");
        setAddressModalOpen(true);
      }
    } catch (error: any) {
      setAddressError(error.message || "Failed to save address");
    } finally {
      setAddressSaving(false);
    }
  };

  const handleAddressUpdate = async () => {
    if (!editingAddressId) {
      return;
    }
    setAddressSaving(true);
    setAddressError("");
    try {
      const payload = {
        label: addressForm.label || "Primary",
        recipientName: addressForm.recipientName,
        phone: addressForm.phone,
        line1: addressForm.line1,
        line2: addressForm.line2,
        city: addressForm.city,
        state: addressForm.state,
        postalCode: addressForm.postalCode,
        country: addressForm.country || "India",
        isDefault: addressForm.isDefault,
      };
      const data = await api.updateAddress(editingAddressId, payload);
      if (Array.isArray(data)) {
        setAddresses(data);
        const newDefault = data.find((addr) => addr.isDefault) || data[0];
        if (newDefault) {
          setSelectedAddressId(String(newDefault._id));
        }
        setAddressMode("select");
        setEditingAddressId(null);
      }
    } catch (error: any) {
      setAddressError(error.message || "Failed to update address");
    } finally {
      setAddressSaving(false);
    }
  };

  const handleAddressDelete = async (id: string) => {
    if (typeof window !== "undefined") {
      const confirmDelete = window.confirm("Delete this address?");
      if (!confirmDelete) return;
    }
    setAddressSaving(true);
    setAddressError("");
    try {
      const data = await api.deleteAddress(id);
      if (Array.isArray(data)) {
        setAddresses(data);
        const newDefault = data.find((addr) => addr.isDefault) || data[0];
        setSelectedAddressId(newDefault ? String(newDefault._id) : null);
        if (data.length === 0) {
          setAddressMode("new");
        }
      }
    } catch (error: any) {
      setAddressError(error.message || "Failed to delete address");
    } finally {
      setAddressSaving(false);
    }
  };

  const handleSetDefault = async (id: string) => {
    setAddressSaving(true);
    setAddressError("");
    try {
      const data = await api.setDefaultAddress(id);
      if (Array.isArray(data)) {
        setAddresses(data);
        const newDefault = data.find((addr) => addr.isDefault) || data[0];
        setSelectedAddressId(newDefault ? String(newDefault._id) : null);
      }
    } catch (error: any) {
      setAddressError(error.message || "Failed to set default");
    } finally {
      setAddressSaving(false);
    }
  };

  const proceedWithAddress = async (addressId: string) => {
    setAddressModalOpen(false);
    setAddressError("");
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action.type === "cart") {
      await handleCheckout(addressId);
      return;
    }
    if (action.type === "buy") {
      await handleBuyFullLot(action.crop, addressId);
    }
  };

  const handleCheckout = async (shippingAddressId: string) => {
    const purchasable = cartSummary.inStockItems;
    if (purchasable.length === 0) {
      setCartAction({ busy: false, status: "", error: "No in-stock items to checkout." });
      return;
    }
    if (cartSummary.hasPending) {
      setCartAction({ busy: false, status: "", error: "Some items are pending on-chain approval." });
      return;
    }
    if (cartSummary.hasMultipleFarmers) {
      setCartAction({ busy: false, status: "", error: "Batch checkout supports only one farmer at a time." });
      return;
    }
    if (!cartSummary.totalWei || cartSummary.totalWei <= 0n) {
      setCartAction({ busy: false, status: "", error: "Unable to calculate total ETH." });
      return;
    }
    setCartAction({ busy: true, status: "Starting checkout...", error: "" });
    try {
      const contract = await getContract();
      const cropIds = purchasable.map((item) => item.contractCropId);
      const units = purchasable.map((item) => Number(item.unitsBase) || 0);
      setCartAction({
        busy: true,
        status: `Processing ${purchasable.length} item(s)...`,
        error: "",
      });
      const tx = await contract.purchaseBatch(cropIds, units, {
        value: cartSummary.totalWei,
      });
      for (const item of purchasable) {
        if (!item.id) continue;
        const lineTotalWei =
          (item.pricePerBaseWei ? BigInt(item.pricePerBaseWei) : 0n) *
          (Number(item.unitsBase) > 0 ? BigInt(item.unitsBase) : 0n);
        const lineTotal = ethers.formatEther(lineTotalWei);
        try {
          await api.createTransactionIntent({
            txHash: tx.hash,
            cropId: item.id,
            valueEth: String(lineTotal),
            units: Number(item.unitsBase) || 0,
            shippingAddressId,
          });
        } catch {
          // optional intent
        }
      }
      await tx.wait();
      setCartItems((prev) => prev.filter((entry) => !purchasable.find((item) => item.id === entry.id)));
      setCartAction({ busy: false, status: "Checkout complete.", error: "" });
      api.getCrops().then((data) => {
        if (Array.isArray(data)) {
          setListings(data);
        }
      });
    } catch (error: any) {
      setCartAction({ busy: false, status: "", error: error.message || "Checkout failed" });
    }
  };

  const handleBuyFullLot = async (crop: any, shippingAddressId: string) => {
    setAction({ id: crop._id || crop.id, status: "", error: "" });
    try {
      if (!crop.contractCropId) {
        throw new Error("On-chain listing pending admin approval.");
      }
      const contract = await getContract();
      const metrics = getListingMetrics(crop);
      const availableBase = metrics.availableBase;
      if (availableBase <= 0) {
        throw new Error("Listing is out of stock.");
      }
      const perBaseWei = metrics.perBaseWei;
      if (perBaseWei <= 0n) {
        throw new Error("Crop price missing.");
      }
      const totalWei = perBaseWei * BigInt(availableBase);
      const valueEth = ethers.formatEther(totalWei);
      const unitsPurchased = availableBase;
      const tx = await contract.purchaseCrop(crop.contractCropId, {
        value: totalWei,
      });
      if (crop._id) {
        try {
          await api.createTransactionIntent({
            txHash: tx.hash,
            cropId: crop._id,
            valueEth: String(valueEth),
            units: unitsPurchased,
            shippingAddressId,
          });
        } catch {
          // intent optional; continue
        }
      }
      setAction({
        id: crop._id || crop.id,
        status: `Transaction sent: ${tx.hash}`,
        error: "",
      });
      await tx.wait();
      api.getCrops().then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setListings(data);
        }
      });
      setAction({
        id: null,
        status: "Purchase confirmed on-chain.",
        error: "",
      });
    } catch (error: any) {
      setAction({
        id: null,
        status: "",
        error: error.message || "Purchase failed",
      });
    }
  };

  const beginCheckout = () => {
    if (cartSummary.inStockItems.length === 0) {
      setCartAction({ busy: false, status: "", error: "No in-stock items to checkout." });
      return;
    }
    if (cartSummary.hasPending) {
      setCartAction({ busy: false, status: "", error: "Some items are pending on-chain approval." });
      return;
    }
    if (cartSummary.hasMultipleFarmers) {
      setCartAction({ busy: false, status: "", error: "Batch checkout supports only one farmer at a time." });
      return;
    }
    openAddressFlow({ type: "cart" });
  };

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <header className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="hud-label">Marketplace</p>
              <h1 className="text-3xl font-bold mt-2">Shop Verified Crops</h1>
              <p className="text-slate-400 mt-2">
                Discover approved listings, compare prices, and purchase directly from farmers.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/buyer/orders"
                className="px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-slate-700/70 rounded-sm hover:border-blue-600"
              >
                My Orders
              </Link>
              <Link
                href="/ledger"
                className="px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-green-600 rounded-sm text-green-400 hover:bg-green-950/50"
              >
                View Ledger
              </Link>
            </div>
          </div>

          <div className="hud-panel p-4 grid grid-cols-1 lg:grid-cols-[1.6fr_0.6fr_0.4fr] gap-4">
            <div>
              <label className="hud-label">Search</label>
              <input
                className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                placeholder="Search crops or categories"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div>
              <label className="hud-label">Sort</label>
              <select
                className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
              >
                <option value="recent">Newest listings</option>
                <option value="price_low">Lowest price / unit</option>
                <option value="price_high">Highest price / unit</option>
                <option value="expiry">Expiry soonest</option>
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setCategoryFilter("All");
                  setUnitFilter("All");
                  setSortBy("recent");
                }}
                className="border border-slate-700/70 text-slate-300 rounded-sm py-3 text-xs font-mono uppercase tracking-[0.2em] hover:border-slate-400"
              >
                Clear
              </button>
            </div>
          </div>
        </header>

        {action.error && (
          <div className="hud-card border border-rose-500/40 text-rose-200">
            {action.error}
          </div>
        )}
        {action.status && (
          <div className="hud-card border border-green-600 text-green-400">
            {action.status}
          </div>
        )}
        {cartAction.error && (
          <div className="hud-card border border-rose-500/40 text-rose-200">
            {cartAction.error}
          </div>
        )}
        {cartAction.status && (
          <div className="hud-card border border-green-600 text-green-400">
            {cartAction.status}
          </div>
        )}

        <div className="hud-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
          <span>Showing {filteredListings.length} of {listings.length}</span>
          <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
            {categoryFilter !== "All" ? categoryFilter : "All categories"} · {unitFilter !== "All" ? unitFilter : "All units"}
          </span>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-6">
          <aside className="space-y-4">
            <div className="hud-panel p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Filters</p>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("All");
                    setUnitFilter("All");
                    setSortBy("recent");
                  }}
                  className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400 hover:text-slate-200"
                >
                  Reset
                </button>
              </div>

              <div className="space-y-2">
                <p className="hud-label">Category</p>
                <button
                  onClick={() => setCategoryFilter("All")}
                  className={`w-full text-left px-3 py-2 rounded-sm border text-xs font-mono uppercase tracking-[0.2em] ${
                    categoryFilter === "All"
                      ? "border-blue-600 text-blue-400 bg-blue-950/50"
                      : "border-slate-700/70 text-slate-300 hover:border-slate-500/70"
                  }`}
                >
                  All Categories
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={`w-full text-left px-3 py-2 rounded-sm border text-xs font-mono uppercase tracking-[0.2em] ${
                      categoryFilter === category
                        ? "border-blue-600 text-blue-400 bg-blue-950/50"
                        : "border-slate-700/70 text-slate-300 hover:border-slate-500/70"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <p className="hud-label">Unit</p>
                <button
                  onClick={() => setUnitFilter("All")}
                  className={`w-full text-left px-3 py-2 rounded-sm border text-xs font-mono uppercase tracking-[0.2em] ${
                    unitFilter === "All"
                      ? "border-green-600 text-green-400 bg-green-950/50"
                      : "border-slate-700/70 text-slate-300 hover:border-slate-500/70"
                  }`}
                >
                  All Units
                </button>
                {units.map((unit) => (
                  <button
                    key={unit}
                    onClick={() => setUnitFilter(unit)}
                    className={`w-full text-left px-3 py-2 rounded-sm border text-xs font-mono uppercase tracking-[0.2em] ${
                      unitFilter === unit
                        ? "border-green-600 text-green-400 bg-green-950/50"
                        : "border-slate-700/70 text-slate-300 hover:border-slate-500/70"
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-4 min-w-0">
            {filteredListings.length === 0 && (
              <div className="hud-card text-sm text-slate-400">
                No listings match your filters yet. Try widening your search.
              </div>
            )}
            {filteredListings.length > 0 && (
              <div className="grid grid-cols-1 gap-4">
                {filteredListings.map((crop: any) => {
                  const cropId = getCropId(crop);
                  const inCart = cropId ? cartIds.has(cropId) : false;
                  const metrics = getListingMetrics(crop);
                  const availableLabel = `${formatQuantityValue(metrics.availableDisplay)} ${crop.quantityUnit || "unit"}`;
                  const perUnitEthLabel =
                    metrics.perUnitEth > 0 ? `${metrics.perUnitEth.toFixed(6)} ETH / ${crop.quantityUnit || "unit"}` : "-";
                  const perUnitInrLabel =
                    metrics.perUnitInr > 0 ? `${metrics.perUnitInr.toFixed(2)} INR / ${crop.quantityUnit || "unit"}` : "-";
                  const outOfStock = metrics.availableBase === 0 || crop.status === "SOLD" || crop.status === "EXPIRED";
                  const images =
                    Array.isArray(crop.imageUrls) && crop.imageUrls.length > 0
                      ? crop.imageUrls
                      : crop.imageUrl
                        ? [crop.imageUrl]
                        : [];
                  const imageUrl = images[0] ? resolveAssetUrl(images[0]) : "";
                  const certUrl = crop.certificateUrl ? resolveAssetUrl(crop.certificateUrl) : "";

                  return (
                    <article key={crop.id || crop._id} className="hud-panel p-5 space-y-4 min-w-0 overflow-hidden">
                      <div className="flex gap-4 min-w-0">
                        <div className="h-24 w-28 flex-shrink-0 rounded-sm border border-slate-700/60 overflow-hidden bg-slate-900/60">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={`${crop.name || "Crop"} image`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-slate-500">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0">
                              <p className="hud-label break-all">{crop.category} · {crop.id || crop._id}</p>
                              <h3 className="text-lg font-semibold mt-1">{crop.name}</h3>
                              <p className="text-xs text-slate-400 mt-1 break-all">
                                Farmer: {crop.farmer || crop.farmerWallet}
                              </p>
                            </div>
                            <div className="ml-auto flex-shrink-0">
                              <StatusBadge
                                label={crop.status === "APPROVED" || crop.status === "Active" ? "Verified" : crop.status}
                                tone={
                                  crop.status === "APPROVED" || crop.status === "Active"
                                    ? "active"
                                    : crop.status === "Pending" || crop.status === "PENDING"
                                      ? "pending"
                                      : "info"
                                }
                              />
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="hud-label">Price / unit</p>
                              <p className="text-slate-200 mt-1">{perUnitEthLabel}</p>
                              <p className="text-xs text-slate-500 mt-1">{perUnitInrLabel}</p>
                            </div>
                            <div>
                              <p className="hud-label">Available</p>
                              <p className="text-slate-200 mt-1">{availableLabel}</p>
                              {outOfStock && (
                                <p className="text-xs text-amber-200 mt-1">Out of stock</p>
                              )}
                            </div>
                            <div>
                              <p className="hud-label">Harvest</p>
                              <p className="text-slate-200 mt-1">
                                {crop.harvest ||
                                  (crop.harvestDate ? new Date(crop.harvestDate).toLocaleDateString() : "-")}
                              </p>
                            </div>
                            <div>
                              <p className="hud-label">Expiry</p>
                              <p className="text-slate-200 mt-1">
                                {crop.expiry ||
                                  (crop.expiryDate ? new Date(crop.expiryDate).toLocaleDateString() : "-")}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      disabled={inCart || outOfStock}
                      onClick={() => addToCart(crop)}
                      className="px-3 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-slate-600/60 rounded-sm text-slate-200 hover:border-slate-400 disabled:opacity-50"
                    >
                      {outOfStock ? "Out of Stock" : inCart ? "In Cart" : "Add to Cart"}
                    </button>
                            <button
                              disabled={action.id === (crop._id || crop.id) || outOfStock}
                              onClick={() => {
                                if (!crop.contractCropId) {
                                  setAction({ id: null, status: "", error: "On-chain listing pending admin approval." });
                                  return;
                                }
                                openAddressFlow({ type: "buy", crop });
                              }}
                              className="px-4 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-blue-600 rounded-sm text-blue-400 hover:bg-blue-950/50 disabled:opacity-50"
                            >
                              {action.id === (crop._id || crop.id) ? "Processing" : "Buy Full Lot"}
                            </button>
                            {certUrl && (
                              <a
                                href={certUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-mono uppercase tracking-[0.2em] text-green-400 underline"
                              >
                                Certificate
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="hud-card">
              <div className="flex items-center justify-between gap-2 text-slate-200">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className="text-blue-300" weight="duotone" />
                  <p className="text-sm font-semibold">Your Cart</p>
                </div>
                <span className="text-xs font-mono uppercase tracking-[0.2em] text-slate-400">{cartItems.length} items</span>
              </div>
              {cartItems.length === 0 ? (
                <p className="text-sm text-slate-400 mt-3">Add listings to collect them here.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {cartItems.map((item) => {
                    const isOut = item.outOfStock || Number(item.availableBase) === 0;
                    const lineTotalWei =
                      (item.pricePerBaseWei ? BigInt(item.pricePerBaseWei) : 0n) *
                      (Number(item.unitsBase) > 0 ? BigInt(item.unitsBase) : 0n);
                    const lineTotal = formatEthFromWei(lineTotalWei, 6);
                    const perUnitEth = Number(item.pricePerUnitEth);
                    const perUnitInr = Number(item.pricePerUnitInr);
                    const perUnitEthLabel =
                      Number.isFinite(perUnitEth) && perUnitEth > 0 ? perUnitEth.toFixed(6) : "-";
                    const perUnitInrLabel =
                      Number.isFinite(perUnitInr) && perUnitInr > 0 ? perUnitInr.toFixed(2) : "-";
                    const availableDisplay = Number(item.availableDisplay) || 0;
                    const unitsDisplayNumber = Number(item.unitsDisplay);
                    const lineTotalInr =
                      Number.isFinite(perUnitInr) && perUnitInr > 0 && Number.isFinite(unitsDisplayNumber)
                        ? perUnitInr * unitsDisplayNumber
                        : null;
                    return (
                      <div
                        key={item.id}
                        className={`border border-slate-700/60 rounded-sm px-3 py-2 space-y-2 ${
                          isOut ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{item.name}</p>
                            <p className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">
                              {item.category || "Crop"} · {item.quantity || "-"}
                            </p>
                            {item.pendingOnchain && (
                              <p className="text-xs text-amber-200 mt-1">Awaiting on-chain approval</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-xs font-mono uppercase tracking-[0.2em] text-rose-200 hover:text-rose-100"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                          <span className="font-mono uppercase tracking-[0.2em]">
                            {perUnitInrLabel !== "-"
                              ? `${perUnitInrLabel} INR / ${item.quantityUnit || "unit"}`
                              : perUnitEthLabel !== "-"
                                ? `${perUnitEthLabel} ETH / ${item.quantityUnit || "unit"}`
                                : "-"}
                          </span>
                          <span className="font-mono uppercase tracking-[0.2em]">
                            {item.unitsDisplay || "0"} {item.quantityUnit || "unit"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-400 font-mono uppercase tracking-[0.2em]">Qty</label>
                            <input
                              type="number"
                              min={stepForScale(item.unitScale)}
                              max={availableDisplay || 0}
                              step={stepForScale(item.unitScale)}
                              disabled={isOut}
                              className="w-20 bg-slate-950 border border-slate-700 rounded-sm px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                              value={item.unitsDisplay ?? ""}
                              onChange={(event) => updateCartUnits(item.id, event.target.value)}
                            />
                            <span className="text-xs text-slate-500">/ {formatQuantityValue(availableDisplay)} {item.quantityUnit || "unit"}</span>
                          </div>
                          {isOut && (
                            <span className="text-xs font-mono uppercase tracking-[0.2em] text-amber-300">
                              Out of stock
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-mono uppercase tracking-[0.2em]">Line Total</span>
                          <span className="font-mono uppercase tracking-[0.2em]">
                            {lineTotalInr !== null ? `${lineTotalInr.toFixed(2)} INR` : `${lineTotal} ETH`}
                          </span>
                        </div>
                        {perUnitInrLabel !== "-" && (
                          <p className="text-[11px] text-slate-500">
                            {perUnitEthLabel !== "-" ? `≈ ${perUnitEthLabel} ETH / ${item.quantityUnit || "unit"}` : ""}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.2em] text-slate-400">
                    <span>Total</span>
                    <span>
                      {cartSummary.totalInr > 0 ? `${cartSummary.totalInr.toFixed(2)} INR` : `${cartSummary.totalEth} ETH`}
                    </span>
                  </div>
                  {cartSummary.totalInr > 0 && (
                    <p className="text-[11px] text-slate-500">
                      ≈ {cartSummary.totalEth} ETH
                    </p>
                  )}
                  {cartSummary.hasMultipleFarmers && (
                    <p className="text-xs text-amber-200">
                      Batch checkout supports items from a single farmer only.
                    </p>
                  )}
                  {cartSummary.hasOutOfStock && (
                    <p className="text-xs text-slate-400">
                      Out-of-stock items stay in your cart but won’t be purchased.
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      disabled={
                        cartAction.busy ||
                        cartSummary.inStockItems.length === 0 ||
                        cartSummary.hasMultipleFarmers ||
                        cartSummary.hasPending
                      }
                      onClick={beginCheckout}
                      className="flex-1 border border-green-600 text-green-400 rounded-sm py-2 text-xs font-mono uppercase tracking-[0.2em] hover:bg-green-950/50 disabled:opacity-50"
                    >
                      {cartAction.busy ? "Processing..." : "Checkout"}
                    </button>
                    <button
                      disabled={cartAction.busy}
                      onClick={clearCart}
                      className="border border-slate-600/60 text-slate-300 rounded-sm py-2 px-3 text-xs font-mono uppercase tracking-[0.2em] hover:border-slate-400 disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>

      {addressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-10">
          <div className="w-full max-w-3xl bg-slate-950/95 border border-slate-700 rounded-sm p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="hud-label">Checkout</p>
                <h3 className="text-2xl font-semibold mt-1">Shipping Address</h3>
                <p className="text-sm text-slate-400 mt-2">
                  Choose a saved address or add a new one.
                </p>
              </div>
              <button
                onClick={() => {
                  setAddressModalOpen(false);
                  setPendingAction(null);
                }}
                className="text-xs font-mono uppercase tracking-[0.2em] border border-slate-700/60 rounded-sm px-4 py-2 text-slate-200 hover:border-slate-400"
              >
                Close
              </button>
            </div>

            {addressError && (
              <div className="rounded-sm border border-rose-500/40 text-rose-200 bg-rose-500/10 px-4 py-3 text-sm">
                {addressError}
              </div>
            )}

            {addressMode === "select" ? (
              <div className="space-y-4">
                {addressLoading ? (
                  <p className="text-sm text-slate-400">Loading saved addresses...</p>
                ) : addresses.length === 0 ? (
                  <div className="hud-card text-sm text-slate-400">
                    No saved addresses yet. Add your shipping address to continue.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.map((addr) => (
                      <label
                        key={addr._id}
                        className={`border rounded-sm p-4 cursor-pointer transition ${
                          String(addr._id) === String(selectedAddressId)
                            ? "border-blue-600 bg-blue-950/50"
                            : "border-slate-700/60 hover:border-slate-600/80"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="shipping-address"
                            checked={String(addr._id) === String(selectedAddressId)}
                            onChange={() => setSelectedAddressId(String(addr._id))}
                            className="mt-1"
                          />
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{addr.label || "Address"}</p>
                              {addr.isDefault && (
                                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-green-400">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-slate-200">{addr.recipientName}</p>
                            <p className="text-slate-400">{addr.phone}</p>
                            <p className="text-slate-400">
                              {addr.line1}
                              {addr.line2 ? `, ${addr.line2}` : ""}
                            </p>
                            <p className="text-slate-400">
                              {addr.city}, {addr.state} {addr.postalCode}
                            </p>
                            <p className="text-slate-400">{addr.country}</p>
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openEditAddress(addr);
                                }}
                                className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-300 hover:text-slate-100"
                              >
                                Edit
                              </button>
                              {!addr.isDefault && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleSetDefault(String(addr._id));
                                  }}
                                  className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-300 hover:text-slate-100"
                                >
                                  Set default
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleAddressDelete(String(addr._id));
                                }}
                                className="text-[10px] font-mono uppercase tracking-[0.2em] text-rose-200 hover:text-rose-100"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={openNewAddress}
                    className="text-xs font-mono uppercase tracking-[0.2em] text-slate-300 hover:text-slate-100"
                  >
                    + Add new address
                  </button>
                  <button
                    disabled={!selectedAddressId}
                    onClick={() => selectedAddressId && proceedWithAddress(selectedAddressId)}
                    className="px-5 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-green-600 text-green-400 rounded-sm hover:bg-green-950/50 disabled:opacity-50"
                  >
                    Deliver to this address
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="hud-label">Label</label>
                    <select
                      className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                      value={addressForm.label}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, label: e.target.value }))}
                    >
                      <option value="Home">Home</option>
                      <option value="Office">Office</option>
                      <option value="Warehouse">Warehouse</option>
                      <option value="Primary">Primary</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="hud-label">Recipient Name</label>
                    <input
                      className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                      value={addressForm.recipientName}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, recipientName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="hud-label">Phone</label>
                    <input
                      className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="hud-label">Line 1</label>
                    <input
                      className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                      value={addressForm.line1}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, line1: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="hud-label">Line 2</label>
                    <input
                      className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                      value={addressForm.line2}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, line2: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="hud-label">City</label>
                    <input
                      className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                      value={addressForm.city}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="hud-label">State</label>
                    <input
                      className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="hud-label">Postal Code</label>
                    <input
                      className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                      value={addressForm.postalCode}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, postalCode: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="hud-label">Country</label>
                    <input
                      className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-sm"
                      value={addressForm.country}
                      onChange={(e) => setAddressForm((prev) => ({ ...prev, country: e.target.value }))}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(e) => setAddressForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  />
                  Set as default address
                </label>

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setAddressMode(addresses.length > 0 ? "select" : "new")}
                    className="text-xs font-mono uppercase tracking-[0.2em] text-slate-300 hover:text-slate-100"
                  >
                    Back to saved addresses
                  </button>
                  <button
                    onClick={addressMode === "edit" ? handleAddressUpdate : handleAddressSave}
                    disabled={addressSaving}
                    className="px-5 py-2 text-xs font-mono uppercase tracking-[0.2em] border border-green-600 text-green-400 rounded-sm hover:bg-green-950/50 disabled:opacity-50"
                  >
                    {addressSaving ? "Saving..." : addressMode === "edit" ? "Update Address" : "Save & Continue"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
