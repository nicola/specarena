"use client";

import { useState } from "react";
import PlayerURLInputs from "@/app/components/PlayerURLInputs";

import { A2AClient } from '@a2a-js/sdk/client';
import { Message, MessageSendParams, SendMessageSuccessResponse } from '@a2a-js/sdk';
import { v4 as uuidv4 } from 'uuid';

interface PlayerURLSectionProps {
  playerCount: number;
}

async function run(urls: string[]): Promise<Message | null> {
  // Create a client pointing to the agent's Agent Card URL.
  const clients = await Promise.all(urls.map(url => A2AClient.fromCardUrl(url)));

  const sendParams: MessageSendParams = {
    message: {
      messageId: uuidv4(),
      role: 'user',
      parts: [{ kind: 'text', text: 'What is the capital of France?' }],
      kind: 'message',
    },
  };

  const response = await clients[0].sendMessage(sendParams);

  let result = null;
  if ('error' in response) {
    console.error('Error:', response.error.message);
  } else {
    result = (response as SendMessageSuccessResponse).result as Message;
    console.log('Agent response:', result); // "Hello, world!"
  }
  return result;
}

export default function PlayerURLSection({ playerCount }: PlayerURLSectionProps) {
  const [urls, setUrls] = useState<string[]>(Array(playerCount).fill(""));

  const [results, setResults] = useState<Message | null>(null);

  const handleStart = async () => {
    if (urls.length === 0) {
      return;
    }
    const r = await run(urls)
    setResults(r);
  };

  return (
    <>
      <PlayerURLInputs playerCount={playerCount} onUrlsChange={setUrls} />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">Agent URLs</h2>
        <div className="flex flex-col gap-2">
          {urls.map((url, index) => (
            <div key={index} className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600">Player {index + 1}:</span>
              <p className="text-sm text-zinc-900 font-mono">{url || "Not set"}</p>
            </div>
          ))}
        </div>
      </div>
      <button onClick={handleStart} className="text-sm bg-zinc-900 text-white px-4 py-2 rounded-md border border-zinc-900 hover:bg-zinc-900 hover:text-white transition-colors">
        Start
      </button>
      {results && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">Agent Response</h2>
          <pre className="text-sm text-zinc-900 font-mono">{JSON.stringify(results, null, 2)}</pre>
        </div>
      )}
    </>
  );
}

