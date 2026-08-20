import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export async function POST(request: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured." },
        { status: 503 },
      );
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const body = await request.json();
    const { agent, action, policy, failureDemo } = body;

    if (!agent || !action) {
      return NextResponse.json(
        { error: "agent and action are required." },
        { status: 400 },
      );
    }

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      temperature: 0,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content:
            "You are ClearX AI. Analyze the blockchain obligation and return ONLY a valid JSON object. " +
            "Do not use markdown. Do not use code fences. Do not add text before or after the JSON. " +
            'The JSON MUST contain exactly these fields: "risk", "recommendation", "summary", "signals". ' +
            '"risk" must be LOW, MEDIUM, or HIGH. ' +
            '"recommendation" must be APPROVE, REVIEW, or BLOCK. ' +
            '"summary" must be a short string. ' +
            '"signals" must be an array containing 1 to 3 short strings. ' +
            "You are advisory only. You never authorize or execute transactions. " +
            "The deterministic ClearX policy remains the final enforcement layer. " +
            "When failureDemo is true, the current execution intentionally simulates a blockchain evidence mismatch. " +
            "In that case, identify the evidence mismatch as a material settlement risk and recommend REVIEW rather than APPROVE. " +
            "Do not ignore failureDemo just because the deterministic policy itself says APPROVE.",
        },
        {
          role: "user",
          content: JSON.stringify({
            agent,
            proposedAction: action,
            deterministicPolicy: policy ?? null,
            failureDemo: failureDemo === true,
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("Groq returned an empty response.");
    }

    console.log("ClearX Groq raw response:", content);

    let analysis;

    try {
      analysis = JSON.parse(content);
    } catch {
      throw new Error("Groq returned invalid JSON.");
    }

    if (
      !analysis ||
      !["LOW", "MEDIUM", "HIGH"].includes(analysis.risk) ||
      !["APPROVE", "REVIEW", "BLOCK"].includes(
        analysis.recommendation,
      ) ||
      typeof analysis.summary !== "string" ||
      !Array.isArray(analysis.signals)
    ) {
      throw new Error("Groq returned an invalid analysis structure.");
    }

    return NextResponse.json({
      provider: "Groq",
      model: "openai/gpt-oss-20b",
      analysis: {
        risk: analysis.risk,
        recommendation: analysis.recommendation,
        summary: analysis.summary,
        signals: analysis.signals.slice(0, 3),
      },
    });
  } catch (error) {
    console.error("ClearX AI analysis error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "AI analysis failed.",
      },
      { status: 500 },
    );
  }
}
