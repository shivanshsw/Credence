// app/api/test-gemini/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({});

export async function GET() {
  try {
    console.log('Testing Gemini API...');
    
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello! Can you respond with 'Gemini API is working!' if you can hear me?",
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      }
    });

    console.log('Gemini response:', response.text);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Gemini API is working!',
      response: response.text 
    });

  } catch (error) {
    console.error('Gemini test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error 
    }, { status: 500 });
  }
}
