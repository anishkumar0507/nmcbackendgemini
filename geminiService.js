import { VertexAI } from "@google-cloud/vertexai";

/* ===============================
   CONFIG
================================ */
const MODEL_NAME = "gemini-2.5-flash";

const cleanJsonString = (text = "") => {
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
};

/* ===============================
   PROMPT (VERY IMPORTANT)
================================ */
const buildCompliancePrompt = ({ inputType, category, analysisMode }) => {
  return `
You are Satark AI, a senior Indian regulatory compliance auditor.

TASK:
Audit the given ${inputType} content for Indian advertising & healthcare compliance.

REGULATIONS:
- Drugs and Magic Remedies Act, 1954 (Schedule J)
- ASCI Code & Healthcare Guidelines 2024
- Consumer Protection Act 2019
- UCPMP 2024
- IRDAI Advertising Norms (if applicable)

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON
- Do NOT return code
- Do NOT return file modifications
- Do NOT wrap response in markdown
- Do NOT repeat points
- Do NOT restart numbering
- Each recommendation must be ACTIONABLE and REPLACEMENT-BASED

RECOMMENDATION STYLE (VERY IMPORTANT):
❌ Wrong: "Remove misleading claim"
✅ Correct:
"Replace the sentence:
  'This medicine cures diabetes permanently'
 with:
  'This product may help support diabetes management when used under medical supervision.'"

FORMAT RULES:
- suggestion: numbered points (1., 2., 3.)
- solution: numbered points (1., 2., 3.)
- Max 3 points per field
- If only 1 point exists, return ONLY "1."

JSON SCHEMA:
{
  "score": number,
  "status": "Compliant" | "Needs Review" | "Non-Compliant",
  "summary": string,
  "transcription": string,
  "financialPenalty": {
    "riskLevel": "High" | "Medium" | "Low" | "None",
    "description": string
  },
  "ethicalMarketing": {
    "score": number,
    "assessment": string
  },
  "violations": [
    {
      "severity": "Critical" | "High" | "Medium" | "Low",
      "regulation": string,
      "description": string,
      "problematicContent": string,
      "englishTranslation": string,
      "suggestion": string,
      "solution": string
    }
  ]
}

ANALYSIS MODE: ${analysisMode || "Standard"}

Return ONLY valid JSON. Do NOT return code. Do NOT return file modifications. Do NOT wrap response in markdown.`;
};

/* ===============================
   MAIN FUNCTION (EXPORTED)
================================ */
export const analyzeWithGemini = async ({
  content,
  inputType = "text",
  category = "General",
  analysisMode = "Standard",
}) => {
  const project = process.env.VERTEX_PROJECT_ID || process.env.VERTEX_AI_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION || process.env.VERTEX_AI_LOCATION || "asia-southeast1";
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!project) {
    throw new Error("VERTEX_PROJECT_ID (or VERTEX_AI_PROJECT_ID) missing");
  }
  if (!location) {
    throw new Error("VERTEX_LOCATION (or VERTEX_AI_LOCATION) missing");
  }
  if (!key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY env variable missing");
  }
  let credentials;
  try {
    credentials = JSON.parse(key);
  } catch (e) {
    console.error("[GeminiService] Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON:", e);
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }
  let vertexAI;
  try {
    vertexAI = new VertexAI({
      project,
      location,
      googleAuthOptions: { credentials },
    });
  } catch (e) {
    console.error("[GeminiService] VertexAI initialization failed:", e);
    throw new Error("VertexAI initialization failed");
  }
  let model;
  try {
    model = vertexAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        topP: 0.95,
      },
    });
  } catch (e) {
    console.error("[GeminiService] getGenerativeModel failed:", e);
    throw new Error("Failed to get generative model");
  }
  const prompt = buildCompliancePrompt({ inputType, category, analysisMode });
  const parts = [ { text: content }, { text: prompt } ];
  let result;
  try {
    result = await model.generateContent({ contents: [{ role: "user", parts }] });
  } catch (e) {
    console.error("[GeminiService] generateContent failed:", e);
    throw new Error("Gemini model generateContent failed");
  }
  let rawText = result?.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!rawText) {
    console.error("[GeminiService] Gemini returned empty response");
    throw new Error("Gemini returned empty response");
  }
  console.log("[GeminiService] Raw Gemini output:", rawText);
  const cleaned = cleanJsonString(rawText);
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[GeminiService] Invalid JSON from Gemini:\n", cleaned);
    throw new Error("Gemini returned incomplete or invalid JSON");
  }
  // Validate unwanted keys
  if (parsed && (parsed.file_path || parsed.modified_content)) {
    console.error("[GeminiService] Invalid Gemini output: contains file modification keys", parsed);
    throw new Error("Gemini returned file modification object instead of compliance JSON");
  }
  return parsed;
};

/* ===============================
   OPTIONAL: AUDIO SUMMARY
================================ */
export const generateAudioSummary = async (text) => {
  const project = process.env.VERTEX_PROJECT_ID || process.env.VERTEX_AI_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION || process.env.VERTEX_AI_LOCATION || "asia-southeast1";
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!project) {
    throw new Error("VERTEX_PROJECT_ID (or VERTEX_AI_PROJECT_ID) missing");
  }
  if (!location) {
    throw new Error("VERTEX_LOCATION (or VERTEX_AI_LOCATION) missing");
  }
  if (!key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY env variable missing");
  }
  let credentials;
  try {
    credentials = JSON.parse(key);
  } catch (e) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }
  const vertexAI = new VertexAI({
    project,
    location,
    googleAuthOptions: { credentials },
  });

  const ttsModel = vertexAI.getGenerativeModel({
    model: "gemini-2.5-flash-preview-tts",
  });

  const result = await ttsModel.generateContent({
    contents: [{ role: "user", parts: [{ text }] }],
  });

  const audioBase64 =
    result?.response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioBase64) {
    throw new Error("Audio generation failed");
  }

  return audioBase64;
};