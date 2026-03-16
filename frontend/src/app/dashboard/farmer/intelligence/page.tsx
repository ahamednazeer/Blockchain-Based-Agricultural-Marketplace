"use client";

import React, { FormEvent, useMemo, useState } from "react";
import {
  ChatCircleDots,
  ChartLineUp,
  PaperPlaneRight,
  SpinnerGap,
  Stethoscope,
  UploadSimple,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";

type ChatLanguage = "auto" | "en" | "ta";
type ResponseLanguage = "en" | "ta";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface ChatApiResponse {
  generatedAt: string;
  answer: string;
  followUps: string[];
  language: ResponseLanguage;
  intent: string;
  engine: string;
}

interface CropHealthApiResponse {
  generatedAt: string;
  language: ResponseLanguage;
  engine: string;
  cropName: string | null;
  diagnosis: {
    issueType: string;
    primaryIssue: string;
    severity: string;
    confidence: number;
    explanation: string;
  };
  remedies: string[];
  preventiveActions: string[];
}

interface ForecastPoint {
  date: string;
  lstmLikeEth: number;
  lstmLikeInr: number;
  arimaLikeEth: number;
  arimaLikeInr: number;
  ensembleEth: number;
  ensembleInr: number;
}

interface ForecastApiResponse {
  generatedAt: string;
  language: ResponseLanguage;
  cropQuery: string;
  horizonDays: number;
  model: string;
  basedOn: {
    samples: number;
    baselineEth: number;
    baselineInr: number;
    reliability: number;
    conversionRate: number;
  };
  historicalSeries: Array<{ date: string; priceEth: number; priceInr: number }>;
  forecastSeries: ForecastPoint[];
  insight: {
    trend: string;
    expectedChangePct: number;
    recommendedSellDate: string | null;
    recommendedExpectedEth: number | null;
    recommendedExpectedInr: number | null;
    advisory: string;
  };
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export default function FarmerIntelligencePage() {
  const [chatLanguage, setChatLanguage] = useState<ChatLanguage>("auto");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-initial",
      role: "assistant",
      text: "Ask me about crop suitability, fertilizer dosage, weather practices, or field issues.",
    },
  ]);
  const [chatFollowUps, setChatFollowUps] = useState<string[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [contextSoil, setContextSoil] = useState("");
  const [contextDistrict, setContextDistrict] = useState("");
  const [contextSeason, setContextSeason] = useState("");
  const [contextCropName, setContextCropName] = useState("");

  const [healthLanguage, setHealthLanguage] = useState<ChatLanguage>("auto");
  const [healthCropName, setHealthCropName] = useState("");
  const [healthSymptoms, setHealthSymptoms] = useState("");
  const [healthImage, setHealthImage] = useState<File | undefined>(undefined);
  const [healthResult, setHealthResult] = useState<CropHealthApiResponse | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [forecastCrop, setForecastCrop] = useState("");
  const [forecastDays, setForecastDays] = useState(7);
  const [forecastLanguage, setForecastLanguage] = useState<ResponseLanguage>("en");
  const [forecastResult, setForecastResult] = useState<ForecastApiResponse | null>(null);
  const [forecastBusy, setForecastBusy] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const historySummary = useMemo(() => {
    if (!forecastResult) {
      return "";
    }
    return `${forecastResult.basedOn.samples} samples | reliability ${Math.round(
      forecastResult.basedOn.reliability * 100
    )}%`;
  }, [forecastResult]);

  const handleChatSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) {
      return;
    }

    const nextUser: ChatMessage = {
      id: makeId("user"),
      role: "user",
      text: message,
    };
    setChatMessages((prev) => [...prev, nextUser]);
    setChatInput("");
    setChatBusy(true);
    setChatError(null);

    try {
      const response = (await api.askAgriChatbot({
        message,
        language: chatLanguage,
        farmContext: {
          soilType: contextSoil || undefined,
          district: contextDistrict || undefined,
          season: contextSeason || undefined,
          cropName: contextCropName || undefined,
        },
      })) as ChatApiResponse;

      const assistant: ChatMessage = {
        id: makeId("assistant"),
        role: "assistant",
        text: response.answer,
      };
      setChatMessages((prev) => [...prev, assistant]);
      setChatFollowUps(Array.isArray(response.followUps) ? response.followUps : []);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to send message");
    } finally {
      setChatBusy(false);
    }
  };

  const handleHealthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (healthBusy) {
      return;
    }

    if (!healthImage && !healthSymptoms.trim()) {
      setHealthError("Upload an image or provide symptom text.");
      return;
    }

    setHealthBusy(true);
    setHealthError(null);
    setHealthResult(null);

    try {
      const response = (await api.assessCropHealth({
        image: healthImage,
        cropName: healthCropName || undefined,
        symptoms: healthSymptoms || undefined,
        language: healthLanguage,
      })) as CropHealthApiResponse;
      setHealthResult(response);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : "Assessment failed");
    } finally {
      setHealthBusy(false);
    }
  };

  const handleForecastSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (forecastBusy) {
      return;
    }

    setForecastBusy(true);
    setForecastError(null);
    setForecastResult(null);

    try {
      const response = (await api.getMarketPriceForecast({
        crop: forecastCrop || undefined,
        days: forecastDays,
        language: forecastLanguage,
      })) as ForecastApiResponse;
      setForecastResult(response);
    } catch (error) {
      setForecastError(error instanceof Error ? error.message : "Forecast failed");
    } finally {
      setForecastBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="hud-card">
        <p className="hud-label">Agri Intelligence Suite</p>
        <h2 className="text-xl font-semibold mt-2">Bilingual Advisor, Crop Health AI, and Price Forecasts</h2>
        <p className="text-sm text-slate-400 mt-2">
          This panel gives field-level guidance in Tamil and English, symptom/image-based crop checks, and short-term market trend support.
        </p>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="hud-card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ChatCircleDots size={20} className="text-blue-400" />
              <p className="font-semibold">Bilingual Agricultural Chatbot</p>
            </div>
            <select
              className="input-modern w-32"
              value={chatLanguage}
              onChange={(event) => setChatLanguage(event.target.value as ChatLanguage)}
            >
              <option value="auto">Auto</option>
              <option value="en">English</option>
              <option value="ta">Tamil</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="input-modern"
              placeholder="Soil type (optional)"
              value={contextSoil}
              onChange={(event) => setContextSoil(event.target.value)}
            />
            <input
              className="input-modern"
              placeholder="District (optional)"
              value={contextDistrict}
              onChange={(event) => setContextDistrict(event.target.value)}
            />
            <input
              className="input-modern"
              placeholder="Season (optional)"
              value={contextSeason}
              onChange={(event) => setContextSeason(event.target.value)}
            />
            <input
              className="input-modern"
              placeholder="Crop (optional)"
              value={contextCropName}
              onChange={(event) => setContextCropName(event.target.value)}
            />
          </div>

          <div className="border border-slate-700/60 rounded-sm p-3 bg-slate-950/60 max-h-[320px] overflow-y-auto space-y-3">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-sm p-3 text-sm ${
                  message.role === "assistant" ? "bg-slate-800/80 border border-slate-700/70" : "bg-blue-950/40 border border-blue-700/50"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <form onSubmit={handleChatSubmit} className="space-y-3">
            <textarea
              className="input-modern min-h-[96px]"
              placeholder="Type your farming question..."
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
            />
            <div className="flex items-center justify-between gap-3">
              <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={chatBusy}>
                {chatBusy ? <SpinnerGap size={18} className="animate-spin" /> : <PaperPlaneRight size={18} />}
                Ask Assistant
              </button>
              {chatError && <p className="text-xs text-red-300">{chatError}</p>}
            </div>
          </form>

          {chatFollowUps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Suggested Follow-ups</p>
              <div className="grid grid-cols-1 gap-2">
                {chatFollowUps.map((item) => (
                  <div key={item} className="text-sm border border-slate-700/60 rounded-sm px-3 py-2 bg-slate-900/60">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hud-card space-y-4">
          <div className="flex items-center gap-2">
            <Stethoscope size={20} className="text-emerald-400" />
            <p className="font-semibold">Crop Health Assessment (Image-Based)</p>
          </div>

          <form onSubmit={handleHealthSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="input-modern"
                placeholder="Crop name (e.g., Tomato)"
                value={healthCropName}
                onChange={(event) => setHealthCropName(event.target.value)}
              />
              <select
                className="input-modern"
                value={healthLanguage}
                onChange={(event) => setHealthLanguage(event.target.value as ChatLanguage)}
              >
                <option value="auto">Auto</option>
                <option value="en">English</option>
                <option value="ta">Tamil</option>
              </select>
            </div>

            <textarea
              className="input-modern min-h-[90px]"
              placeholder="Symptoms (optional): yellow leaves, spots, wilting..."
              value={healthSymptoms}
              onChange={(event) => setHealthSymptoms(event.target.value)}
            />

            <label className="flex items-center justify-center gap-2 border border-dashed border-slate-600 rounded-sm p-4 cursor-pointer hover:border-slate-400">
              <UploadSimple size={18} />
              <span className="text-sm">{healthImage ? healthImage.name : "Upload crop image"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setHealthImage(event.target.files?.[0])}
              />
            </label>

            <div className="flex items-center justify-between gap-3">
              <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={healthBusy}>
                {healthBusy ? <SpinnerGap size={18} className="animate-spin" /> : <UploadSimple size={18} />}
                Assess Crop Health
              </button>
              {healthError && <p className="text-xs text-red-300">{healthError}</p>}
            </div>
          </form>

          {healthResult && (
            <div className="space-y-3 border border-slate-700/60 rounded-sm p-3 bg-slate-950/60">
              <p className="text-sm">
                <span className="text-slate-400">Diagnosis:</span>{" "}
                <span className="font-semibold">{healthResult.diagnosis.primaryIssue}</span>
              </p>
              <p className="text-xs text-slate-400">
                {healthResult.diagnosis.issueType} | {healthResult.diagnosis.severity} severity | confidence{" "}
                {Math.round(healthResult.diagnosis.confidence * 100)}%
              </p>
              <p className="text-sm text-slate-300">{healthResult.diagnosis.explanation}</p>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Remedies</p>
                <div className="mt-2 space-y-2">
                  {healthResult.remedies.map((item) => (
                    <p key={item} className="text-sm border border-slate-700/60 rounded-sm px-3 py-2">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="hud-card space-y-4">
        <div className="flex items-center gap-2">
          <ChartLineUp size={20} className="text-amber-400" />
          <p className="font-semibold">Market Price Prediction</p>
        </div>

        <form onSubmit={handleForecastSubmit} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3">
          <input
            className="input-modern"
            placeholder="Crop name or category (optional)"
            value={forecastCrop}
            onChange={(event) => setForecastCrop(event.target.value)}
          />
          <select
            className="input-modern w-full md:w-36"
            value={forecastDays}
            onChange={(event) => setForecastDays(Number(event.target.value))}
          >
            <option value={3}>3 days</option>
            <option value={5}>5 days</option>
            <option value={7}>7 days</option>
            <option value={10}>10 days</option>
            <option value={14}>14 days</option>
          </select>
          <select
            className="input-modern w-full md:w-32"
            value={forecastLanguage}
            onChange={(event) => setForecastLanguage(event.target.value as ResponseLanguage)}
          >
            <option value="en">English</option>
            <option value="ta">Tamil</option>
          </select>
          <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2" disabled={forecastBusy}>
            {forecastBusy ? <SpinnerGap size={18} className="animate-spin" /> : <ChartLineUp size={18} />}
            Forecast
          </button>
        </form>

        {forecastError && <p className="text-xs text-red-300">{forecastError}</p>}

        {forecastResult && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              {forecastResult.model} | {historySummary}
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
              <div className="border border-slate-700/60 rounded-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/80 text-slate-300">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-right px-3 py-2" title="Values in INR">LSTM-Like (₹)</th>
                      <th className="text-right px-3 py-2" title="Values in INR">ARIMA-Like (₹)</th>
                      <th className="text-right px-3 py-2" title="Values in INR">Ensemble (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecastResult.forecastSeries.map((point) => (
                      <tr key={point.date} className="border-t border-slate-800">
                        <td className="px-3 py-2">{point.date}</td>
                        <td className="px-3 py-2 text-right text-slate-400">
                          {point.lstmLikeInr ? point.lstmLikeInr.toFixed(2) : point.lstmLikeEth.toFixed(4)}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-400">
                          {point.arimaLikeInr ? point.arimaLikeInr.toFixed(2) : point.arimaLikeEth.toFixed(4)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-amber-100">
                          {point.ensembleInr ? point.ensembleInr.toFixed(2) : point.ensembleEth.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border border-slate-700/60 rounded-sm p-3 bg-slate-950/60 space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Forecast Insight</p>
                <p className="text-sm">
                  Trend: <span className="font-semibold">{forecastResult.insight.trend}</span>
                </p>
                <p className="text-sm">
                  Expected Change: <span className="font-semibold">{forecastResult.insight.expectedChangePct}%</span>
                </p>
                <p className="text-sm">
                  Suggested Sell Date:{" "}
                  <span className="font-semibold">{forecastResult.insight.recommendedSellDate || "N/A"}</span>
                </p>
                <p className="text-sm text-slate-300">{forecastResult.insight.advisory}</p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
