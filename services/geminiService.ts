
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

const generateContent = async (prompt: string): Promise<string | null> => {
    if (!API_KEY) {
        return "Gemini API key is not configured. Please set the API_KEY environment variable.";
    }
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            return `Error communicating with Gemini: ${error.message}`;
        }
        return "An unknown error occurred while calling the Gemini API.";
    }
};

export const generateDailySummary = (prompt: string): Promise<string | null> => {
    return generateContent(prompt);
};

export const generateMenuIdeas = (prompt: string): Promise<string | null> => {
    return generateContent(prompt);
};
