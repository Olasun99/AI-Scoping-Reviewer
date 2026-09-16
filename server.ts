import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // GEMINI AI Screening API
  app.post("/api/screen", async (req, res) => {
    try {
      const { abstract, title, inclusionCriteria, exclusionCriteria } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured across the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `You are an expert reviewer screening an abstract for a scoping review. 
Review the following abstract and metadata against the given inclusion and exclusion criteria.
Decide if the paper should be "included" or "excluded".
Also provide a short "reason" (max 1 sentence) explaining why.

Inclusion Criteria: ${inclusionCriteria}
Exclusion Criteria: ${exclusionCriteria}

Title: ${title}
Abstract: ${abstract}

Output your decision strictly in JSON format as follows (and nothing else):
{"decision": "included" | "excluded", "reason": "brief reason"}
`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      });

      let responseText = response.text || "{}";
      const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const result = JSON.parse(cleanedText);
      res.json(result);
      
    } catch (error: any) {
      console.error("Screening error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GEMINI AI Advanced Extraction API
  app.post("/api/extract", async (req, res) => {
    try {
      const { title, abstract, reviewType } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured across the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `You are an expert meta-analyst and data extractor.
Review the following title and abstract to extract structured research data.
If a piece of information is not available in the text, leave it as an empty string.

Title: ${title}
Abstract: ${abstract}

Extract the following information as a JSON object with this exact structure:
{
  "studyCharacteristics": {
    "population": "...",
    "age": "...",
    "sex": "...",
    "inclusionCriteria": "...",
    "exclusionCriteria": "...",
    "followUpPeriod": "...",
    "setting": "...",
    "randomization": "...",
    "blinding": "..."
  },
  "interventionDetails": {
    "intervention": "...",
    "comparator": "...",
    "dose": "...",
    "frequency": "...",
    "duration": "...",
    "route": "...",
    "treatmentProtocol": "..."
  }
}
`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      });

      let responseText = response.text || "{}";
      const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const result = JSON.parse(cleanedText);
      res.json(result);
      
    } catch (error: any) {
      console.error("Extraction error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // GEMINI AI Auto-Fill Framework API
  app.post("/api/auto-fill-framework", async (req, res) => {
    try {
      const { title, inclusionCriteria, frameworkType } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is not configured." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      let prompt = "";
      if (frameworkType === 'PICO') {
        prompt = `You are an expert in systematic reviews. Based on the project title and inclusion criteria, suggest the PICO framework components.
Title: ${title}
Inclusion Criteria: ${inclusionCriteria}

Output JSON with exact structure:
{
  "p": "population description",
  "i": "intervention description",
  "c": "comparator description",
  "o": "outcome description"
}`;
      } else {
        prompt = `You are an expert in scoping reviews. Based on the project title and inclusion criteria, suggest the PCC framework components.
Title: ${title}
Inclusion Criteria: ${inclusionCriteria}

Output JSON with exact structure:
{
  "p": "population description",
  "c": "concept description",
  "c2": "context description"
}`;
      }
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        }
      });

      let responseText = response.text || "{}";
      const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      const result = JSON.parse(cleanedText);
      if (frameworkType === 'PICO') {
        res.json({ pico: result });
      } else {
        res.json({ pcc: result });
      }
      
    } catch (error: any) {
      console.error("Auto-fill error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
