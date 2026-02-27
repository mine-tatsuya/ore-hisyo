import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export function getGeminiModel(
  modelName: "gemini-1.5-flash" | "gemini-1.5-pro" = "gemini-1.5-flash"
) {
  return genAI.getGenerativeModel({ model: modelName });
}
