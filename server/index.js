import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit'; // 🚀 Import the rate limiter
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

// ⚡ Define the Rate Limiting Rules
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 5, // Limit each IP to 5 test generation requests per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: {
        success: false,
        error: 'Too many test generation requests from this IP. Please try again after 15 minutes.'
    }
});

// Initialize the Gemini client
const ai = new GoogleGenAI({});

// 🔒 Apply the rate limiter middleware exclusively to your AI generation route
app.post('/api/generate-tests', apiLimiter, async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log("🚀 Requirement received. Generating high-fidelity test matrix via Gemini...");

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: `Generate an exhaustive list of QA test cases for this feature requirement: ${prompt}`,
            config: {
                systemInstruction: `You are an elite Lead QA Automation Engineer and Software Manual Tester. Your task is to analyze the user's software requirement, feature description, or user story and compile a comprehensive, production-grade QA test suite matrix.
                You must deeply evaluate multiple testing horizons: Positive Paths, Negative Paths, and Boundary Value Analysis.
                Provide highly descriptive test titles, clear preconditions, step-by-step execution lists, and explicit expected verification results.`,
                
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        testCases: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.INTEGER },
                                    title: { type: Type.STRING, description: "A detailed scenario title explaining what is being tested." },
                                    type: { type: Type.STRING, description: "Must strictly be 'Positive', 'Negative', or 'Boundary'" },
                                    preconditions: { type: Type.STRING, description: "System status or user access level needed before starting." },
                                    steps: {
                                        type: Type.ARRAY,
                                        items: { type: Type.STRING },
                                        description: "Sequential list of clear actions the tester must perform."
                                    },
                                    expectedResult: { type: Type.STRING, description: "The exact UI change, error message, or system response that indicates a pass." }
                                },
                                required: ["id", "title", "type", "preconditions", "steps", "expectedResult"],
                            },
                        },
                    },
                    required: ["testCases"],
                },
            },
        });

        const aiOutput = response.text;
        const parsedData = JSON.parse(aiOutput);

        console.log(`✅ Successfully compiled ${parsedData.testCases.length} deep test cases!`);
        res.json({ success: true, data: parsedData.testCases });

    } catch (error) {
        console.error('Gemini Execution Error:', error);
        res.status(500).json({ success: false, error: 'Failed to compile test cases via Gemini.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Gemini Workspace Server listening on http://localhost:${PORT}`);
});