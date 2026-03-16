import "dotenv/config";
import { buildMarketPriceForecast } from "./src/services/agriIntelligence.js";

async function testForecast() {
  const history = [
    { date: "2026-02-15", priceEth: 0.015 },
    { date: "2026-02-16", priceEth: 0.016 }
  ];
  
  const result = await buildMarketPriceForecast({
    cropQuery: "tomato",
    language: "en",
    horizonDays: 7,
    history
  });
  
  console.log(JSON.stringify(result, null, 2));
}

testForecast().catch(console.error);
