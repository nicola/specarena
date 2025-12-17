import { NextRequest, NextResponse } from "next/server";
import { getInvite, ChallengeError } from "../../challenges/storage";
import { sendMessage } from "../../chat/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const { inviteId } = await params;

  const result = getInvite(inviteId);

  if (!result.success) {
    if (result.error === ChallengeError.NOT_FOUND) {
      return NextResponse.json(
        { error: result.message },
        { status: 404 }
      );
    }
    if (result.error === ChallengeError.INVITE_ALREADY_USED) {
      return NextResponse.json(
        { error: result.message },
        { status: 409 }
      );
    }
    // Fallback for unknown errors
    return NextResponse.json(
      { error: result.message },
      { status: 500 }
    );
  }

  return NextResponse.json(result.data);
}