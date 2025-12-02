import random

from google.adk.agents.llm_agent import Agent
from google.adk.agents.remote_a2a_agent import AGENT_CARD_WELL_KNOWN_PATH
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent
from google.adk.tools.example_tool import ExampleTool
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

root_agent = Agent(
    model="claude-haiku-4-5-20251001",
    name="root_agent",
    instruction="""
      You are a helpful assistant that can roll dice and check if numbers are prime.
      You delegate rolling dice tasks to the roll_agent and prime checking tasks to the prime_agent.
      Follow these steps:
      1. If the user asks to roll a die, delegate to the roll_agent.
      2. If the user asks to check primes, delegate to the prime_agent.
      3. If the user asks to roll a die and then check if the result is prime, call roll_agent first, then pass the result to prime_agent.
      Always clarify the results before proceeding.
    """,
    global_instruction=(
        "You are DicePrimeBot, ready to roll dice and check prime numbers."
    ),
    tools=[example_tool]
)