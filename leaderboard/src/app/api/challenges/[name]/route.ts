import { NextResponse } from "next/server";
import { createChallenge } from "../storage";

export async function POST({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  try {

    const challenge = createChallenge(name);

    return NextResponse.json(challenge);
  } catch (error) {
    console.error("Error creating challenge:", error);
    return NextResponse.json(
      { error: "Failed to create challenge" },
      { status: 500 }
    );
  }
}

