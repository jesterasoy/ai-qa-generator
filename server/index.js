import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Rate Limiter for AI Endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15, 
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Rate limit reached. Please wait a few minutes before generating more data.'
    }
});

const ai = new GoogleGenAI({});

// --- Existing Endpoint: Generate Test Cases ---
app.post('/api/generate-tests', apiLimiter, async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', 
            contents: `Generate an exhaustive list of QA test cases for this feature requirement: ${prompt}`,
            config: {
                systemInstruction: `You are an elite Lead QA Automation Engineer. Analyze the requirements and compile a structured QA test suite matrix with positive, negative, and boundary testing criteria. Provide concise preconditions and clear sequential actions.`,
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
                                    title: { type: Type.STRING },
                                    type: { type: Type.STRING },
                                    preconditions: { type: Type.STRING },
                                    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    expectedResult: { type: Type.STRING }
                                },
                                required: ["id", "title", "type", "preconditions", "steps", "expectedResult"],
                            },
                        },
                    },
                    required: ["testCases"],
                },
            },
        });
        res.json({ success: true, data: JSON.parse(response.text).testCases });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Failed to compile test cases.' });
    }
});

// 🚀 --- UPDATED ENDPOINT: Intelligent Bug Report Generator (with auto-generated reproduction paths) ---
app.post('/api/generate-bug-report', apiLimiter, async (req, res) => {
    const { testCase, actualNotes, environment } = req.body;

    if (!testCase || !actualNotes) {
        return res.status(400).json({ success: false, error: 'Test case metadata and actual run observations are required.' });
    }

    console.log(`🤖 Generating professional defect report for: "${testCase.title}"...`);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a professional, engineering-grade defect report based on this failed test run execution data:
            - Test Title / Brief Summary: ${testCase.title}
            - Testing Type: ${testCase.type}
            - System Preconditions: ${testCase.preconditions || 'None Provided'}
            - Given Reproduction Steps (May be generic or missing): ${JSON.stringify(testCase.steps)}
            - Documented Expected Result: ${testCase.expectedResult || 'None Provided'}
            - Live Testing Failure Logs/Notes: ${actualNotes}
            - Target Environment Info: ${environment || 'Staging / Production Preview v1.0.0'}`,
            config: {
                systemInstruction: `You are an expert Senior QA Analyst. Your task is to transform raw test observations, brief summaries, and failure logs into an authoritative Jira-ready bug ticket description. 
                
                CRITICAL DIRECTIVE: If the input data contains only a brief summary and missing sequential instructions, use your deep understanding of software application structures, standard UI UX flows, and API logic to logically deduce and AUTOMATICALLY GENERATE the exact step-by-step reproduction path.
                
                Synthesize a crisp, searchable bug title prefixing severity (e.g., "[CRITICAL] Summary..."). 
                Determine the logical Severity Level ("Critical", "Major", or "Minor").
                Generate a clean, professional markdown layout for the final report markdown field, structuring description components, clear auto-scaffolded steps, and error logs cleanly.`,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        bugTitle: { type: Type.STRING, description: "Jira-style crisp header summary with bracketed tracking attributes." },
                        severity: { type: Type.STRING, description: "Must strictly be 'Critical', 'Major', or 'Minor' based on business impact." },
                        markdownReport: { type: Type.STRING, description: "The full comprehensive bug ticket body formatted cleanly using standard Markdown syntax wrappers containing sections for Description, Automatically Generated Steps to Reproduce, Expected Result, and Actual logs." }
                    },
                    required: ["bugTitle", "severity", "markdownReport"],
                }
            }
        });

        const bugReportData = JSON.parse(response.text);
        res.json({ success: true, data: bugReportData });

    } catch (error) {
        console.error('Bug Generator Error:', error);
        res.status(500).json({ success: false, error: 'Failed to synthesize formal bug report asset via AI.' });
    }
});

app.listen(PORT, () => console.log(`🚀 Workspace Server listening on http://localhost:${PORT}`));