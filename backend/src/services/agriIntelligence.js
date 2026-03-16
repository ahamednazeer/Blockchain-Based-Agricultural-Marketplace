const DEFAULT_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_CHAT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

const getGroqConfig = () => ({
  apiKey: String(process.env.GROQ_API_KEY || "").trim(),
  apiUrl: String(process.env.GROQ_API_URL || DEFAULT_GROQ_API_URL).trim(),
  chatModel: String(process.env.GROQ_CHAT_MODEL || process.env.GROQ_MODEL || DEFAULT_CHAT_MODEL).trim(),
  visionModel: String(process.env.GROQ_VISION_MODEL || DEFAULT_VISION_MODEL).trim(),
  timeoutMs: Math.max(1200, Number(process.env.GROQ_TIMEOUT_MS || 4000)),
});

const TAMIL_CHAR_PATTERN = /[\u0B80-\u0BFF]/;
const TAMIL_ROMAN_HINTS = [
  "enna",
  "epdi",
  "eppadi",
  "payir",
  "vivasayam",
  "mannu",
  "nilam",
  "mazhai",
  "uram",
  "thanni",
  "velanmai",
  "sapadu",
];

const CHAT_KNOWLEDGE = [
  {
    id: "crop_suitability",
    keywords: [
      "suitable crop",
      "which crop",
      "best crop",
      "crop for my land",
      "soil type",
      "payir",
      "nilam",
      "mannu",
      "ethu payir",
      "enna payir",
    ],
    en: {
      answer:
        "Select crops based on soil texture, water access, pH, and expected rainfall. For short-duration safety, start with millets, pulses, or vegetables suited to your local market demand.",
      followUps: [
        "Share your soil type and irrigation source for a better crop shortlist.",
        "Tell me your district and season to refine crop suitability.",
      ],
    },
    ta: {
      answer:
        "நிலத்துக்கு ஏற்ற பயிரை தேர்வு செய்ய மண் வகை, தண்ணீர் கிடைப்பு, மழை நிலை, மற்றும் சந்தை தேவை முக்கியம். குறுகிய காலத்தில் பாதுகாப்பாக தொடங்க கம்பு/பயறு/காய்கறி வகைகள் நல்ல தேர்வு.",
      followUps: [
        "உங்கள் மண் வகை மற்றும் நீர்ப்பாசன தகவலை சொன்னால் துல்லியமான பயிர் பட்டியல் தரலாம்.",
        "உங்கள் மாவட்டம் மற்றும் சீசன் சொன்னால் சரியான பரிந்துரை தர முடியும்.",
      ],
    },
  },
  {
    id: "fertilizer_planning",
    keywords: [
      "fertilizer",
      "dose",
      "npk",
      "nitrogen",
      "urea",
      "dap",
      "how much fertilizer",
      "uram",
      "சத்து",
      "உரம்",
    ],
    en: {
      answer:
        "Use soil-test values first. A practical baseline is split application: 30-40% basal, 30% vegetative stage, and remaining at flowering/fruit set. Avoid one-shot heavy nitrogen.",
      followUps: [
        "Share crop name and age to estimate stage-wise fertilizer split.",
        "Do you have soil-test NPK values? I can convert them into a dose plan.",
      ],
    },
    ta: {
      answer:
        "உரம் அளவு மண் பரிசோதனைக்கு ஏற்ப இருக்க வேண்டும். பொதுவாக 30-40% அடிப்படை, 30% வளர்ச்சி நிலையில, மீதியை பூக்கும்/காய் கட்டும் நிலையில் பிரித்து போடுங்கள். ஒரே தடவையில் அதிக நைட்ரஜன் விட வேண்டாம்.",
      followUps: [
        "பயிர் பெயர் மற்றும் நாட்களை சொன்னால் கட்டங்கட்டமாக உர அட்டவணை தரலாம்.",
        "மண் பரிசோதனை NPK மதிப்புகள் இருந்தால் துல்லியமாக கணக்கிடலாம்.",
      ],
    },
  },
  {
    id: "weather_practice",
    keywords: [
      "weather",
      "rain",
      "hot",
      "temperature",
      "climate",
      "current weather",
      "mazhai",
      "veyil",
      "மழை",
      "வெயில்",
    ],
    en: {
      answer:
        "In rainy periods, improve drainage and reduce foliar spray frequency. In heat stress, irrigate early morning, mulch, and avoid fertilizer during peak afternoon temperatures.",
      followUps: [
        "Share your expected weather this week for a day-by-day farm action plan.",
        "Tell me if your field has drainage issues so I can suggest preventive steps.",
      ],
    },
    ta: {
      answer:
        "மழைக்காலத்தில் வடிகால் சரியாக இருக்க வேண்டும், இலை தெளிப்பு அடிக்கடி வேண்டாம். அதிக வெப்பத்தில் அதிகாலை பாசனம், மல்‌ச் போடுதல், மதிய வெயிலில் உரம் தவிர்த்தல் நல்ல நடைமுறை.",
      followUps: [
        "இந்த வார வானிலை சொல்லுங்கள், தினசரி செய்யவேண்டிய பண்ணை திட்டம் தருகிறேன்.",
        "நிலத்தில் நீர் தேக்கம் பிரச்சனை இருந்தால் தடுப்பு வழிகள் சொல்லுகிறேன்.",
      ],
    },
  },
  {
    id: "best_practices",
    keywords: [
      "best practice",
      "good practice",
      "improve yield",
      "farming practice",
      "agricultural practice",
      "velanmai",
      "vivasayam tips",
      "சிறந்த",
      "விவசாயம்",
    ],
    en: {
      answer:
        "Follow seed treatment, stage-wise nutrition, weekly pest scouting, moisture monitoring, and timely harvest. Record each input and yield to improve decisions next season.",
      followUps: [
        "I can share a weekly checklist for your crop stage.",
        "Tell me your crop and acreage to build a simple cost-yield tracker.",
      ],
    },
    ta: {
      answer:
        "விதை சிகிச்சை, கட்டங்கட்டமான சத்து மேலாண்மை, வாராந்திர பூச்சி கண்காணிப்பு, மண் ஈரப்பதம் கண்காணிப்பு, மற்றும் சரியான நேரத்தில் அறுவடை செய்வது நல்ல மகசூலுக்கு உதவும்.",
      followUps: [
        "உங்கள் பயிருக்கு வாராந்திர செயல் பட்டியல் தருகிறேன்.",
        "பயிர் மற்றும் ஏக்கர் அளவு சொன்னால் செலவு-மகசூல் பதிவேடு மாதிரி தரலாம்.",
      ],
    },
  },
];

const RULE_DIAGNOSES = [
  {
    issueType: "NUTRIENT_DEFICIENCY",
    primaryIssue: "Nitrogen deficiency",
    severity: "MEDIUM",
    keywords: ["yellow leaf", "yellowing", "pale leaf", "chlorosis", "மஞ்சள்", "manjal", "yelow"],
    explanation:
      "Leaves turning pale or yellow, especially older leaves, often indicates nitrogen deficiency.",
    remedies: [
      "Apply nitrogen-rich fertilizer in split doses (for example urea or ammonium sulfate).",
      "Add compost or well-decomposed farmyard manure to improve nutrient retention.",
      "Irrigate lightly after fertilizer application to improve uptake.",
    ],
    preventiveActions: [
      "Use soil testing before fertilizer planning.",
      "Avoid large one-time nitrogen application; use stage-wise split doses.",
    ],
  },
  {
    issueType: "DISEASE",
    primaryIssue: "Fungal leaf spot risk",
    severity: "MEDIUM",
    keywords: ["brown spot", "black spot", "leaf spot", "patch", "புள்ளி", "karuppu"],
    explanation:
      "Circular brown or black lesions can indicate fungal leaf spot in humid field conditions.",
    remedies: [
      "Remove heavily affected leaves and avoid overhead irrigation late in the day.",
      "Use a crop-safe fungicide recommended for the crop and disease stage.",
      "Increase field airflow by proper spacing and pruning where applicable.",
    ],
    preventiveActions: [
      "Avoid prolonged leaf wetness in evening hours.",
      "Use disease-free planting material.",
    ],
  },
  {
    issueType: "STRESS",
    primaryIssue: "Water stress",
    severity: "MEDIUM",
    keywords: ["wilting", "droop", "dry", "curl", "சுருக்கு", "வாடல்", "thanni illa"],
    explanation:
      "Leaf rolling or wilting may result from irrigation imbalance or sudden heat stress.",
    remedies: [
      "Stabilize irrigation intervals and avoid long dry gaps.",
      "Use mulch to reduce evaporation losses.",
      "Prefer morning irrigation during high-temperature periods.",
    ],
    preventiveActions: [
      "Track soil moisture regularly.",
      "Use drip or controlled irrigation where feasible.",
    ],
  },
  {
    issueType: "DISEASE",
    primaryIssue: "Powdery mildew risk",
    severity: "HIGH",
    keywords: ["white powder", "powder", "mildew", "vellai", "வெள்ளை தூள்"],
    explanation:
      "White powder-like growth on leaves is commonly associated with powdery mildew infection.",
    remedies: [
      "Remove infected tissue and maintain field sanitation.",
      "Apply sulfur-based or recommended fungicide at label dosage.",
      "Avoid dense canopy and improve ventilation.",
    ],
    preventiveActions: [
      "Monitor early signs on lower leaves.",
      "Avoid excessive nitrogen that creates dense, susceptible canopy.",
    ],
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonFromText(raw) {
  let text = String(raw || "").trim();
  if (!text) return null;

  // 1. Extract JSON block if surrounded by markdown
  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    text = text.slice(objectStart, objectEnd + 1);
  }

  // 2. Try standard parse
  try {
    return JSON.parse(text);
  } catch {
    // Continue
  }

  // 3. Attempt to "Heal" common LLM JSON errors
  // Error Type A: Colons inside arrays like ["Key": "Value"]
  // LLMs sometimes hallucinate this syntax instead of just ["Value"]
  let healed = text.replace(/\[\s*("[^"]+"\s*:\s*("[^"]+"))/g, '[$2'); 
  healed = healed.replace(/,\s*("[^"]+"\s*:\s*("[^"]+"))/g, ', $2');

  try {
    return JSON.parse(healed);
  } catch {
    return null;
  }
}

function languageFromUserInput(inputLanguage, message) {
  const requested = String(inputLanguage || "").toLowerCase();
  if (requested === "ta" || requested === "en") {
    return requested;
  }

  const text = String(message || "");
  if (TAMIL_CHAR_PATTERN.test(text)) {
    return "ta";
  }

  const normalized = normalizeText(text);
  const tamilHints = TAMIL_ROMAN_HINTS.reduce(
    (count, hint) => count + (normalized.includes(hint) ? 1 : 0),
    0
  );
  return tamilHints >= 2 ? "ta" : "en";
}

function findIntent(message) {
  const text = normalizeText(message);
  let topIntent = null;
  let topScore = 0;

  for (const intent of CHAT_KNOWLEDGE) {
    const score = intent.keywords.reduce(
      (sum, keyword) => sum + (text.includes(normalizeText(keyword)) ? 1 : 0),
      0
    );
    if (score > topScore) {
      topScore = score;
      topIntent = intent;
    }
  }

  return {
    intent: topIntent,
    matched: topScore > 0,
  };
}

function buildContextLine(farmContext, language) {
  if (!farmContext || typeof farmContext !== "object") {
    return "";
  }

  const details = [];
  if (farmContext.soilType) {
    details.push(`soil: ${farmContext.soilType}`);
  }
  if (farmContext.district) {
    details.push(`district: ${farmContext.district}`);
  }
  if (farmContext.season) {
    details.push(`season: ${farmContext.season}`);
  }
  if (farmContext.cropName) {
    details.push(`crop: ${farmContext.cropName}`);
  }
  if (!details.length) {
    return "";
  }

  if (language === "ta") {
    return `கிடைத்த பண்ணை தகவல்: ${details.join(", ")}.`;
  }
  return `Farm context considered: ${details.join(", ")}.`;
}

function getDefaultFallback(language) {
  if (language === "ta") {
    return {
      answer:
        "உங்கள் கேள்வியை புரிந்துகொண்டேன். மண் வகை, பயிர் பெயர், நிலத்தின் இடம், மற்றும் பயிர் வயது கொடுத்தால் மிகவும் துல்லியமான ஆலோசனை தர முடியும்.",
      followUps: [
        "மண் வகை மற்றும் தற்போதைய பயிர் பெயரை சொல்லுங்கள்.",
        "உரம் அல்லது பூச்சி மேலாண்மை பற்றி கேட்கலாம்.",
      ],
    };
  }

  return {
    answer:
      "I can help with crop choice, fertilizer planning, weather-based practices, and disease prevention. Share soil type, crop stage, and location for a more precise recommendation.",
    followUps: [
      "Tell me your soil type and irrigation availability.",
      "Share crop name and age for stage-wise guidance.",
    ],
  };
}

async function callGroq(messages, options = {}) {
  const config = getGroqConfig();
  if (!config.apiKey) {
    return "";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || config.chatModel,
        temperature: options.temperature ?? 0.25,
        max_tokens: options.maxTokens ?? 420,
        messages,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[callGroq] API Error: ${response.status} ${response.statusText}`);
      const errBody = await response.text();
      console.error(`[callGroq] Error Payload:`, errBody);
      return "";
    }
    const payload = await response.json();
    return String(payload?.choices?.[0]?.message?.content || "").trim();
  } catch (err) {
    console.error(`[callGroq] Fetch Exception:`, err);
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function cleanSuggestions(items) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => String(item || "").trim())
    .filter((item) => item.length >= 10 && item.length <= 160)
    .slice(0, 4);
}

export function isAgriGroqEnabled() {
  return Boolean(getGroqConfig().apiKey);
}

export async function resolveChatbotResponse({ message, language, farmContext }) {
  const resolvedLanguage = languageFromUserInput(language, message);
  const { intent, matched } = findIntent(message);
  const fallback = matched
    ? { answer: intent[resolvedLanguage].answer, followUps: intent[resolvedLanguage].followUps }
    : getDefaultFallback(resolvedLanguage);
  const contextLine = buildContextLine(farmContext, resolvedLanguage);
  const fallbackAnswer = contextLine ? `${fallback.answer}\n\n${contextLine}` : fallback.answer;
  const intentId = intent?.id || "general";

  if (!isAgriGroqEnabled()) {
    return {
      answer: fallbackAnswer,
      followUps: fallback.followUps,
      language: resolvedLanguage,
      intent: intentId,
      engine: "RULE_BASED",
    };
  }

  const messages = [
    {
      role: "system",
      content:
        "You are an agricultural assistant for Indian farmers. Always output valid JSON: {answer:string, followUps:string[], intent:string}. Keep answer short and practical. If language=ta, answer in simple Tamil suitable for informal village speech.",
    },
    {
      role: "user",
      content: JSON.stringify({
        language: resolvedLanguage,
        message,
        farmContext: farmContext || {},
        allowedIntents: CHAT_KNOWLEDGE.map((entry) => entry.id).concat(["general"]),
        constraints: [
          "Avoid medical or legal claims.",
          "Give direct farming guidance with clear actions.",
          "Use max 120 words in answer.",
        ],
      }),
    },
  ];

  const content = await callGroq(messages, { model: getGroqConfig().chatModel, maxTokens: 280, temperature: 0.2 });
  const parsed = parseJsonFromText(content);
  const answer = String(parsed?.answer || "").trim();
  const followUps = cleanSuggestions(parsed?.followUps);
  const parsedIntent = String(parsed?.intent || intentId || "general").trim() || "general";

  if (!answer) {
    return {
      answer: fallbackAnswer,
      followUps: fallback.followUps,
      language: resolvedLanguage,
      intent: intentId,
      engine: "RULE_BASED",
    };
  }

  return {
    answer,
    followUps: followUps.length ? followUps : fallback.followUps,
    language: resolvedLanguage,
    intent: parsedIntent,
    engine: "GROQ",
  };
}

function pickRuleDiagnosis(symptomBlob) {
  const normalized = normalizeText(symptomBlob);
  let best = null;
  let bestScore = 0;

  for (const candidate of RULE_DIAGNOSES) {
    const score = candidate.keywords.reduce(
      (sum, keyword) => sum + (normalized.includes(normalizeText(keyword)) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best || bestScore === 0) {
    return {
      issueType: "UNKNOWN",
      primaryIssue: "Insufficient visual evidence",
      severity: "LOW",
      confidence: 0.42,
      explanation:
        "The image and symptom text are not specific enough for a reliable diagnosis. Add close-up leaf photos and symptom timing.",
      remedies: [
        "Upload a sharper image of affected leaves and stems in daylight.",
        "Share crop age, irrigation pattern, and recent fertilizer use.",
      ],
      preventiveActions: [
        "Inspect field weekly for early symptoms.",
        "Track fertilizer and irrigation log for faster diagnosis.",
      ],
    };
  }

  return {
    issueType: best.issueType,
    primaryIssue: best.primaryIssue,
    severity: best.severity,
    confidence: clamp(0.54 + bestScore * 0.08, 0.55, 0.9),
    explanation: best.explanation,
    remedies: best.remedies,
    preventiveActions: best.preventiveActions,
  };
}

async function resolveVisionDiagnosis({
  cropName,
  symptoms,
  language,
  imageBuffer,
  imageMimeType,
}) {
  if (!isAgriGroqEnabled() || !imageBuffer || !imageMimeType) {
    return null;
  }

  const base64 = imageBuffer.toString("base64");
  const imageUrl = `data:${imageMimeType};base64,${base64}`;

  const messages = [
    {
      role: "system",
      content:
        "You are an agricultural plant pathology assistant. Analyze the crop image and respond with strict JSON: {issueType, primaryIssue, severity, confidence, explanation, remedies, preventiveActions}. Important: remedies and preventiveActions must be ARRAYS OF STRINGS ONLY. Do NOT use key-value pairs inside these arrays. example: [\"Action 1\", \"Action 2\"]. confidence must be between 0 and 1.",
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            cropName: cropName || "Unknown crop",
            symptoms: symptoms || "No extra notes",
            language: language || "en",
            severityScale: ["LOW", "MEDIUM", "HIGH"],
            issueTypeAllowed: ["DISEASE", "NUTRIENT_DEFICIENCY", "STRESS", "UNKNOWN"],
          }),
        },
        {
          type: "image_url",
          image_url: { url: imageUrl },
        },
      ],
    },
  ];

  const content = await callGroq(messages, {
    model: getGroqConfig().visionModel,
    maxTokens: 360,
    temperature: 0.1,
  });
  
  const parsed = parseJsonFromText(content);

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const issueType = String(parsed.issueType || "UNKNOWN").toUpperCase();
  const primaryIssue = String(parsed.primaryIssue || "").trim();
  const explanation = String(parsed.explanation || "").trim();
  if (!primaryIssue || !explanation) {
    return null;
  }

  return {
    issueType: ["DISEASE", "NUTRIENT_DEFICIENCY", "STRESS", "UNKNOWN"].includes(issueType)
      ? issueType
      : "UNKNOWN",
    primaryIssue,
    severity: ["LOW", "MEDIUM", "HIGH"].includes(String(parsed.severity || "").toUpperCase())
      ? String(parsed.severity).toUpperCase()
      : "MEDIUM",
    confidence: clamp(Number(parsed.confidence || 0.72), 0.35, 0.98),
    explanation,
    remedies: cleanSuggestions(parsed.remedies).slice(0, 5),
    preventiveActions: cleanSuggestions(parsed.preventiveActions).slice(0, 5),
  };
}

function localizeAssessment(result, language) {
  if (language !== "ta") {
    return result;
  }

  const tamilExplanation =
    result.issueType === "NUTRIENT_DEFICIENCY"
      ? "இலை நிற மாற்றம் சத்து குறைபாட்டை காட்டுகிறது. கட்டங்கட்டமாக உரம் மேலாண்மை செய்யுங்கள்."
      : result.issueType === "DISEASE"
        ? "இது நோய் அறிகுறியாக இருக்கலாம். பாதிக்கப்பட்ட இலைகளை அகற்றி பரிந்துரைக்கப்பட்ட மருந்தை பயன்படுத்துங்கள்."
        : result.issueType === "STRESS"
          ? "நீர் அல்லது வெப்ப அழுத்தம் இருக்கலாம். பாசன இடைவெளியை சமநிலைப்படுத்துங்கள்."
          : "துல்லியமான முடிவுக்கு மேலும் தெளிவான படம் மற்றும் அறிகுறி தகவல் தேவை.";

  return {
    ...result,
    explanation: `${result.explanation} ${tamilExplanation}`.trim(),
  };
}

export async function resolveCropHealthAssessment({
  cropName,
  symptoms,
  language,
  imageBuffer,
  imageMimeType,
  imageName,
}) {
  const resolvedLanguage = languageFromUserInput(language, symptoms || imageName || cropName || "");
  const symptomBlob = [cropName, symptoms, imageName].filter(Boolean).join(" ");
  const ruleDiagnosis = pickRuleDiagnosis(symptomBlob);
  const visionDiagnosis = await resolveVisionDiagnosis({
    cropName,
    symptoms,
    language: resolvedLanguage,
    imageBuffer,
    imageMimeType,
  });

  const diagnosis = visionDiagnosis || ruleDiagnosis;
  const localized = localizeAssessment(diagnosis, resolvedLanguage);

  return {
    language: resolvedLanguage,
    diagnosis: {
      issueType: localized.issueType,
      primaryIssue: localized.primaryIssue,
      severity: localized.severity,
      confidence: Number(localized.confidence.toFixed(2)),
      explanation: localized.explanation,
    },
    remedies: (localized.remedies || []).slice(0, 5),
    preventiveActions: (localized.preventiveActions || []).slice(0, 5),
    engine: visionDiagnosis ? "GROQ_VISION" : "RULE_BASED",
  };
}

function mean(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundEth(value) {
  return Number(Number(value || 0).toFixed(6));
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((point) => ({
      date: String(point?.date || "").slice(0, 10),
      priceEth: Number(point?.priceEth || 0),
    }))
    .filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.priceEth) && point.priceEth > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function holtLinearForecast(series, horizon) {
  if (!series.length) {
    return Array.from({ length: horizon }, () => 0);
  }

  if (series.length === 1) {
    return Array.from({ length: horizon }, () => series[0]);
  }

  const alpha = 0.44;
  const beta = 0.21;
  let level = series[0];
  let trend = series[1] - series[0];

  for (let idx = 1; idx < series.length; idx += 1) {
    const value = series[idx];
    const nextLevel = alpha * value + (1 - alpha) * (level + trend);
    const nextTrend = beta * (nextLevel - level) + (1 - beta) * trend;
    level = nextLevel;
    trend = nextTrend;
  }

  return Array.from({ length: horizon }, (_, index) => Math.max(0, level + (index + 1) * trend));
}

function arimaLikeForecast(series, horizon) {
  if (!series.length) {
    return Array.from({ length: horizon }, () => 0);
  }
  if (series.length === 1) {
    return Array.from({ length: horizon }, () => series[0]);
  }

  const deltas = [];
  for (let idx = 1; idx < series.length; idx += 1) {
    deltas.push(series[idx] - series[idx - 1]);
  }
  const recentDeltas = deltas.slice(-7);
  const baseDrift = mean(recentDeltas);
  const recentMean = mean(series.slice(-5));

  let cursor = series[series.length - 1];
  const output = [];
  for (let step = 1; step <= horizon; step += 1) {
    const dampedDrift = baseDrift * Math.pow(0.88, step - 1);
    const projected = cursor + dampedDrift;
    cursor = 0.72 * projected + 0.28 * recentMean;
    output.push(Math.max(0, cursor));
  }
  return output;
}

function nextIsoDay(dateText, daysAhead) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

export async function buildMarketPriceForecast({ cropQuery, language, horizonDays, history, ethInrRate = 0 }) {
  const resolvedLanguage = languageFromUserInput(language, cropQuery || "");
  const normalizedHistory = normalizeHistory(history);
  const horizon = clamp(Number(horizonDays || 7), 3, 14);
  const series = normalizedHistory.map((point) => point.priceEth);
  const anchorDate =
    normalizedHistory.length > 0
      ? normalizedHistory[normalizedHistory.length - 1].date
      : new Date().toISOString().slice(0, 10);
  const baseline = series.length ? series[series.length - 1] : 0;

  const lstmLike = holtLinearForecast(series, horizon);
  const arimaLike = arimaLikeForecast(series, horizon);
  let ensemble = lstmLike.map((value, idx) => (value + arimaLike[idx]) / 2);

  let engine = "ENSEMBLE_LSTM_ARIMA";
  let finalAdvisory = "";
  let finalTrend = "STABLE";
  
  const inrBaseline = roundEth(baseline * ethInrRate);
  const inrHistorical = normalizedHistory.slice(-14).map((p) => ({
    date: p.date,
    priceInr: roundEth(p.priceEth * ethInrRate)
  }));

  if (isAgriGroqEnabled() && series.length > 0 && ethInrRate > 0) {
    const messages = [
      {
        role: "system",
        content: `You are an agricultural economist AI. Analyze the historical crop prices. Predict the next ${horizon} days. Output strict JSON: { "forecastPricesInr": [number], "advisory": "string", "trend": "UPWARD" | "DOWNWARD" | "STABLE" }. The array must have exactly ${horizon} numbers (prices in INR) based on the realistic trend. Make the advisory practical (max 50 words). If language=ta, respond in Tamil.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          crop: cropQuery || "Unknown",
          language: resolvedLanguage,
          historicalDateAndPricesInr: inrHistorical,
          baselineInr: inrBaseline,
          daysToPredict: horizon,
        }),
      },
    ];

    const content = await callGroq(messages, {
      model: getGroqConfig().chatModel,
      maxTokens: 400,
      temperature: 0.2,
    });
    
    const parsed = parseJsonFromText(content);
    if (
      parsed &&
      Array.isArray(parsed.forecastPricesInr) &&
      parsed.forecastPricesInr.length === horizon &&
      parsed.advisory
    ) {
      // The AI predicted values in INR. Convert back to ETH for the mathematical ensemble backbone,
      // as our internal format relies on ETH calculations.
      ensemble = parsed.forecastPricesInr.map((n) => Math.max(0, (Number(n) || 0) / ethInrRate));
      finalAdvisory = String(parsed.advisory);
      finalTrend = ["UPWARD", "DOWNWARD", "STABLE"].includes(parsed.trend)
        ? parsed.trend
        : "STABLE";
      engine = "GROQ_LLM";
    }
  }

  const forecastRows = ensemble.map((priceEth, idx) => {
    const date = nextIsoDay(anchorDate, idx + 1);
    return {
      date,
      lstmLikeEth: roundEth(lstmLike[idx]),
      lstmLikeInr: ethInrRate ? roundEth(lstmLike[idx] * ethInrRate) : 0,
      arimaLikeEth: roundEth(arimaLike[idx]),
      arimaLikeInr: ethInrRate ? roundEth(arimaLike[idx] * ethInrRate) : 0,
      ensembleEth: roundEth(priceEth),
      ensembleInr: ethInrRate ? roundEth(priceEth * ethInrRate) : 0,
    };
  });

  const lastPredicted = forecastRows[forecastRows.length - 1]?.ensembleEth ?? baseline;
  let changePct = baseline > 0 ? ((lastPredicted - baseline) / baseline) * 100 : 0;

  if (engine !== "GROQ_LLM") {
    finalTrend = changePct > 2 ? "UPWARD" : changePct < -2 ? "DOWNWARD" : "STABLE";
    const advisoryEn =
      finalTrend === "UPWARD"
        ? `Price trend looks upward for ${cropQuery || "this crop"}. Delaying sale by a few days may improve margin.`
        : finalTrend === "DOWNWARD"
          ? `Price trend is softening for ${cropQuery || "this crop"}. Consider phased or earlier selling.`
          : `Price appears stable for ${cropQuery || "this crop"}. Sell based on storage cost and cash-flow needs.`;
    const advisoryTa =
      finalTrend === "UPWARD"
        ? `${cropQuery || "இந்த பயிர்"} விலை ஏற்ற திசையில் உள்ளது. சில நாள் காத்திருந்து விற்றால் அதிக வருமானம் கிடைக்க வாய்ப்பு உள்ளது.`
        : finalTrend === "DOWNWARD"
          ? `${cropQuery || "இந்த பயிர்"} விலை குறையும் போக்கு காட்டுகிறது. படிப்படியாக அல்லது விரைவாக விற்பனை செய்ய பரிசீலிக்கவும்.`
          : `${cropQuery || "இந்த பயிர்"} விலை நிலையாக உள்ளது. சேமிப்பு செலவு மற்றும் பணப்புழக்கத்தை வைத்து விற்பனை முடிவு எடுக்கலாம்.`;
    finalAdvisory = resolvedLanguage === "ta" ? advisoryTa : advisoryEn;
  }

  const maxRow =
    forecastRows.reduce(
      (best, row) => (best && best.ensembleEth > row.ensembleEth ? best : row),
      null
    ) || null;

  const reliability = clamp(0.4 + normalizedHistory.length * 0.03, 0.4, 0.92);

  return {
    language: resolvedLanguage,
    cropQuery: cropQuery || "All crops",
    horizonDays: horizon,
    basedOn: {
      samples: normalizedHistory.length,
      baselineEth: roundEth(baseline),
      baselineInr: inrBaseline,
      reliability: Number(reliability.toFixed(2)),
      conversionRate: ethInrRate,
    },
    historicalSeries: normalizedHistory.map((point) => ({
      date: point.date,
      priceEth: roundEth(point.priceEth),
      priceInr: ethInrRate > 0 ? roundEth(point.priceEth * ethInrRate) : 0,
    })),
    forecastSeries: forecastRows,
    insight: {
      trend: finalTrend,
      expectedChangePct: Number(changePct.toFixed(2)),
      recommendedSellDate: maxRow?.date || null,
      recommendedExpectedEth: maxRow ? roundEth(maxRow.ensembleEth) : null,
      recommendedExpectedInr: maxRow && ethInrRate ? roundEth(maxRow.ensembleEth * ethInrRate) : null,
      advisory: finalAdvisory,
    },
    model: engine,
  };
}
