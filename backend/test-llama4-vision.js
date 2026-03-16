import "dotenv/config";
import https from "https";
import { resolveCropHealthAssessment } from "./src/services/agriIntelligence.js";

async function run() {
  console.log("Testing Llama 4 Scout with Drought Image...");
  
  // Using the drought image URL from the context/prompt logic or a known stable one
  // For the sake of this test, I'll use a local buffer if I had it, but I'll use a placeholder or download again.
  // Actually, I'll use the bacterial spot image again just to verify the MODEL's vision support first.
  
  const buffer = await new Promise((resolve, reject) => {
    https.get("https://raw.githubusercontent.com/spMohanty/PlantVillage-Dataset/master/raw/color/Tomato___Bacterial_spot/00a7c269-3476-4d25-b744-44d6353cd921___GCREC_Bact.Sp%205807.JPG", (res) => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
  });

  const model = "meta-llama/llama-4-scout-17b-16e-instruct";
  console.log(`Using model: ${model}`);

  const result = await resolveCropHealthAssessment({
    cropName: "Corn",
    symptoms: "Drought and wilting",
    language: "en",
    imageBuffer: buffer,
    imageMimeType: "image/jpeg",
    imageName: "drought.jpg",
  });
  
  console.log("\nRESULT:");
  console.log(JSON.stringify(result, null, 2));
}

run().catch(console.error);
