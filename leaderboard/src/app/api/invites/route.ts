import { NextRequest, NextResponse } from "next/server";
import { getInvite, ChallengeError } from "../challenges/storage";
import { sendMessage } from "../chat/storage";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { inviteId } = body;
  
  if (!inviteId) {
    return NextResponse.json(
      { error: "inviteId is required" },
      { status: 400 }
    );
  }

  const result = getInvite(inviteId);
  if (!result.success) {
    const status = result.error === ChallengeError.NOT_FOUND ? 404 : 409;
    return NextResponse.json(
      { error: result.message },
      { status }
    );
  }
  
  // TODO: this channel is unsafe, anyone can write to it
  // TODO: this requires fixing authentication
  sendMessage("invites", 'operator', `${inviteId}`);

  return NextResponse.json({ success: true });
}