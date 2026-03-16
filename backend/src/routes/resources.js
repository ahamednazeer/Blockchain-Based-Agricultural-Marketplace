import express from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { auth } from "../middleware/auth.js";
import { generateGroqResourceTips, isGroqEnabled } from "../services/groq.js";

const router = express.Router();

const RESOURCE_LIBRARY = {
  storageGuidelines: [
    {
      cropCategory: "Vegetables",
      guidance: "Use ventilated crates, 4-10C cooling where possible, and avoid floor stacking.",
      humidity: "85-95%",
      temperature: "4-10C",
    },
    {
      cropCategory: "Fruits",
      guidance: "Separate ethylene-sensitive produce, maintain airflow, and dispatch bruising-prone fruits first.",
      humidity: "85-90%",
      temperature: "8-14C",
    },
    {
      cropCategory: "Grains",
      guidance: "Store below 14% moisture in dry bins, use pallets, and inspect weekly for insects.",
      humidity: "<65%",
      temperature: "Ambient dry storage",
    },
    {
      cropCategory: "Leafy Greens",
      guidance: "Pre-cool after harvest, keep shaded, and use insulated boxes for same-day movement.",
      humidity: "90-95%",
      temperature: "2-6C",
    },
  ],
  supportCatalog: [
    {
      id: "ventilated-crates",
      section: "STORAGE_SUPPORT",
      title: "Ventilated Plastic Crates",
      description: "Stackable crates that reduce bruising and improve airflow during storage and transport.",
      whyRecommended: "Best for vegetables and fruits that lose quality quickly when packed in sacks.",
      provider: "Amazon",
      buyUrl: "https://www.amazon.in/s?k=ventilated+plastic+crates",
      imageUrl: "/resources/ventilated-crates.svg",
      priority: "HIGH",
      categories: ["Vegetables", "Fruits", "Leafy Greens"],
    },
    {
      id: "shade-nets",
      section: "STORAGE_SUPPORT",
      title: "Shade Nets",
      description: "UV-resistant nets for temporary shaded holding before pickup or local dispatch.",
      whyRecommended: "Helps reduce field heat and moisture loss when cold storage is unavailable.",
      provider: "Amazon",
      buyUrl: "https://www.amazon.in/s?k=shade+net+for+agriculture",
      imageUrl: "/resources/shade-nets.svg",
      priority: "MEDIUM",
      categories: ["Vegetables", "Fruits", "Leafy Greens"],
    },
    {
      id: "storage-racks",
      section: "STORAGE_SUPPORT",
      title: "Storage Racks",
      description: "Raised racks that keep produce off the floor and improve warehouse hygiene.",
      whyRecommended: "Useful for grains, onions, potatoes, and pre-packed produce awaiting pickup.",
      provider: "IndiaMART",
      buyUrl: "https://www.indiamart.com/impcat/storage-racks.html",
      imageUrl: "/resources/storage-racks.svg",
      priority: "HIGH",
      categories: ["Vegetables", "Fruits", "Grains"],
    },
    {
      id: "insulated-boxes",
      section: "STORAGE_SUPPORT",
      title: "Insulated Boxes",
      description: "Temperature-buffered boxes for fragile produce in short-haul fulfillment.",
      whyRecommended: "Extends freshness during last-mile delivery and reduces spoilage complaints.",
      provider: "Amazon",
      buyUrl: "https://www.amazon.in/s?k=insulated+box+food+delivery",
      imageUrl: "/resources/insulated-boxes.svg",
      priority: "HIGH",
      categories: ["Vegetables", "Fruits", "Leafy Greens"],
    },
    {
      id: "thermohygrometer",
      section: "RECOMMENDED_TOOLS",
      title: "Thermometer / Hygrometer",
      description: "Combined sensor for monitoring storage temperature and humidity.",
      whyRecommended: "Lets farmers detect storage drift before produce quality drops.",
      provider: "Amazon",
      buyUrl: "https://www.amazon.in/s?k=thermometer+hygrometer",
      imageUrl: "/resources/thermohygrometer.svg",
      priority: "HIGH",
      categories: ["Vegetables", "Fruits", "Grains", "Leafy Greens"],
    },
    {
      id: "moisture-meter",
      section: "RECOMMENDED_TOOLS",
      title: "Digital Moisture Meter",
      description: "Portable meter for grains, pulses, and storage-ready produce lots.",
      whyRecommended: "Supports grade confidence and prevents moisture-led spoilage during warehousing.",
      provider: "Amazon",
      buyUrl: "https://www.amazon.in/s?k=digital+grain+moisture+meter",
      imageUrl: "/resources/moisture-meter.svg",
      priority: "HIGH",
      categories: ["Grains"],
    },
  ],
  externalPurchaseLinks: [
    {
      title: "Cold Chain and Storage Equipment",
      provider: "IndiaMART",
      url: "https://www.indiamart.com/",
    },
    {
      title: "Farm Packaging and Crates",
      provider: "Amazon Business",
      url: "https://www.amazon.in/business",
    },
    {
      title: "Agri Input Marketplace",
      provider: "IFFCO eBazar",
      url: "https://www.iffcoebazar.in/",
    },
  ],
};

router.get(
  "/farmer",
  auth,
  asyncHandler(async (req, res) => {
    const category = String(req.query.category || "").trim();
    const normalizedCategory = category.toLowerCase();

    const filteredGuidelines = category
      ? RESOURCE_LIBRARY.storageGuidelines.filter(
          (entry) => entry.cropCategory.toLowerCase() === normalizedCategory
        )
      : RESOURCE_LIBRARY.storageGuidelines;

    const filteredCatalog = category
      ? RESOURCE_LIBRARY.supportCatalog.filter((item) =>
          item.categories.some((itemCategory) => itemCategory.toLowerCase() === normalizedCategory)
        )
      : RESOURCE_LIBRARY.supportCatalog;

    const recommendedEquipment = filteredCatalog
      .filter((item) => item.section === "RECOMMENDED_TOOLS")
      .map((item) => ({
        name: item.title,
        purpose: item.description,
        priority: item.priority,
        whyRecommended: item.whyRecommended,
        provider: item.provider,
        buyUrl: item.buyUrl,
        imageUrl: item.imageUrl,
      }));

    const aiTips = await generateGroqResourceTips({
      category: category || "General",
      storageGuidelines: filteredGuidelines.map((entry) => ({
        cropCategory: entry.cropCategory,
        guidance: entry.guidance,
      })),
      recommendedEquipment: recommendedEquipment.map((item) => ({
        name: item.name,
        purpose: item.purpose,
        priority: item.priority,
      })),
    });
    const aiEngine = aiTips.length > 0 && isGroqEnabled() ? "GROQ" : "RULE_BASED";

    res.json({
      generatedAt: new Date().toISOString(),
      sections: [
        { id: "STORAGE_SUPPORT", label: "Storage Support" },
        { id: "RECOMMENDED_TOOLS", label: "Recommended Tools" },
      ],
      categories: Array.from(
        new Set(RESOURCE_LIBRARY.storageGuidelines.map((item) => item.cropCategory))
      ),
      storageGuidelines: filteredGuidelines,
      supportCatalog: filteredCatalog,
      recommendedEquipment,
      externalPurchaseLinks: RESOURCE_LIBRARY.externalPurchaseLinks,
      aiTips,
      aiEngine,
    });
  })
);

export default router;
