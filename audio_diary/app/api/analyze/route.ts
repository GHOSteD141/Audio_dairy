import { NextResponse } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

export async function POST(req: Request) {
  try {
    const provider = req.headers.get('x-provider') || 'google';
    const apiKey = req.headers.get('x-api-key');
    const modelName = req.headers.get('x-model') || (provider === 'google' ? 'gemini-1.5-flash' : provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-haiku-20240307');

    if (!apiKey || apiKey.trim() === '') {
      return NextResponse.json({ 
        error: 'Cannot be described as Gemini API or any API key is not connected.',
        result: {
          title: "Voice Recording",
          glyph: "desk",
          feedback: "Cannot be described as Gemini API or any API key is not connected.",
          goals: [],
          moodScore: null,
          moodLabel: null,
          tags: ["Voice Log"]
        }
      }, { status: 400 });
    }

    const { transcript } = await req.json();

    if (!transcript || transcript.trim() === '') {
      return NextResponse.json({ 
        result: {
          title: "Voice Recording",
          glyph: "desk",
          feedback: "Cannot be described as Gemini API or any API key is not connected.",
          goals: [],
          moodScore: null,
          moodLabel: null,
          tags: ["Voice Log"]
        }
      });
    }

    let model;
    if (provider === 'google') {
      const google = createGoogleGenerativeAI({ apiKey });
      model = google(modelName);
    } else if (provider === 'openai') {
      const openai = createOpenAI({ apiKey });
      model = openai(modelName);
    } else if (provider === 'anthropic') {
      const anthropic = createAnthropic({ apiKey });
      model = anthropic(modelName);
    } else {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    const prompt = `You are an empathetic AI journaling assistant. Analyze this voice transcript:
"${transcript}"

Extract and generate the following JSON fields:
- "title": A short, evocative 3 to 5-word title summarizing the spoken content.
- "glyph": Select exactly ONE icon category from this list: ["desk", "relax", "sleep", "nature", "idea"].
- "feedback": A short summary of the user's spoken words.
- "goals": Array of SMART goal strings extracted from what the user explicitly said. If none mentioned, return [].
- "moodScore": Number 1-10 or null.
- "moodLabel": Single emotional descriptor or null.
- "tags": Array of 2-4 string tags.

Return ONLY valid JSON format without markdown code blocks:
{
  "title": "string",
  "glyph": "desk",
  "feedback": "string",
  "goals": [],
  "moodScore": 7,
  "moodLabel": "Focused",
  "tags": ["work"]
}`;

    const { text } = await generateText({ model, prompt });
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return NextResponse.json({ result: JSON.parse(jsonString) });
  } catch (err: any) {
    return NextResponse.json({ 
      error: err.message || 'Failed to analyze transcript',
      result: {
        title: "Voice Recording",
        glyph: "desk",
        feedback: "Cannot be described as Gemini API or any API key is not connected.",
        goals: [],
        moodScore: null,
        moodLabel: null,
        tags: ["Voice Log"]
      }
    }, { status: 500 });
  }
}