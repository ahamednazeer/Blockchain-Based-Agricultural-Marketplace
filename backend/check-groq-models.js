import "dotenv/config";

async function checkModels() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("No GROQ_API_KEY found");
    return;
  }

  console.log("Checking models on Groq...");
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const data = await response.json();
    if (data.data) {
      console.log("Supported Models:");
      data.data.forEach(m => console.log(`- ${m.id}`));
      
      const requestedModel = "meta-llama/llama-4-scout-17b-16e-instruct";
      const isSupported = data.data.some(m => m.id === requestedModel);
      console.log(`\nRequested model [${requestedModel}] support: ${isSupported}`);
    } else {
      console.log("Error fetching models:", data);
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

checkModels();
