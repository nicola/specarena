import { NextResponse } from "next/server";
import { challenges } from "./storage";

export async function GET() {
  // Convert the Map to an array of challenge objects
  const challengesList = Array.from(challenges.values());
  
  return NextResponse.json({
    challenges: challengesList,
    count: challengesList.length,
  });
}

