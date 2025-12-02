import random

from google.adk.agents.llm_agent import Agent
from google.adk.agents.remote_a2a_agent import AGENT_CARD_WELL_KNOWN_PATH
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent
from google.adk.tools.example_tool import ExampleTool
from google.adk.tools.mcp_tool.mcp_toolset import MCPToolset, StreamableHTTPConnectionParams
from google.adk.models.registry import LLMRegistry
from google.genai import types
from google.adk.a2a.utils.agent_to_a2a import to_a2a

from .claude_direct import ClaudeDirect

LLMRegistry.register(ClaudeDirect)

example_tool = ExampleTool([
    {
        "input": {
            "role": "user",
            "parts": [{"text": "Roll a 6-sided die."}],
        },
        "output": [
            {"role": "model", "parts": [{"text": "I rolled a 4 for you."}]}
        ],
    },
    {
        "input": {
            "role": "user",
            "parts": [{"text": "Is 7 a prime number?"}],
        },
        "output": [{
            "role": "model",
            "parts": [{"text": "Yes, 7 is a prime number."}],
        }],
    },
    {
        "input": {
            "role": "user",
            "parts": [{"text": "Roll a 10-sided die and check if it's prime."}],
        },
        "output": [
            {
                "role": "model",
                "parts": [{"text": "I rolled an 8 for you."}],
            },
            {
                "role": "model",
                "parts": [{"text": "8 is not a prime number."}],
            },
        ],
    },
])

# MCP tool configuration from .mcp.json
mcp_toolset = MCPToolset(
    connection_params=StreamableHTTPConnectionParams(
        url="http://localhost:8201/mcp",
    )
)

root_agent = Agent(
    model="claude-haiku-4-5-20251001",
    name="root_agent",
    instruction="""
      You are a competitive agent. You are playing a game of competitive programming.
    """,
    global_instruction=(
        "You are a competitive agent. You are playing a game of competitive programming."
    ),
    tools=[mcp_toolset]
)