"""Custom Claude implementation using Anthropic's direct API instead of Vertex AI."""

import os
from functools import cached_property
from typing import AsyncGenerator
from typing import TYPE_CHECKING

from anthropic import Anthropic
from anthropic import NOT_GIVEN
from anthropic import types as anthropic_types
from google.genai import types
from typing_extensions import override

from google.adk.models.anthropic_llm import (
    content_to_message_param,
    function_declaration_to_tool_param,
    message_to_generate_content_response,
)
from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_response import LlmResponse

if TYPE_CHECKING:
    from google.adk.models.llm_request import LlmRequest

__all__ = ["ClaudeDirect"]


class ClaudeDirect(BaseLlm):
    """Integration with Claude models using Anthropic's direct API (not Vertex AI).

    Attributes:
        model: The name of the Claude model.
        max_tokens: The maximum number of tokens to generate.
    """

    model: str = "claude-3-5-sonnet-20241022"
    max_tokens: int = 8192

    @classmethod
    @override
    def supported_models(cls) -> list[str]:
        return [r"claude-3-.*", r"claude-.*-4.*"]

    @override
    async def generate_content_async(
        self, llm_request: "LlmRequest", stream: bool = False
    ) -> AsyncGenerator[LlmResponse, None]:
        messages = [
            content_to_message_param(content)
            for content in llm_request.contents or []
        ]
        tools = NOT_GIVEN
        if (
            llm_request.config
            and llm_request.config.tools
            and llm_request.config.tools[0].function_declarations
        ):
            tools = [
                function_declaration_to_tool_param(tool)
                for tool in llm_request.config.tools[0].function_declarations
            ]
        tool_choice = (
            anthropic_types.ToolChoiceAutoParam(type="auto")
            if llm_request.tools_dict
            else NOT_GIVEN
        )
        # TODO: Enable streaming for anthropic models.
        message = self._anthropic_client.messages.create(
            model=llm_request.model,
            system=llm_request.config.system_instruction,
            messages=messages,
            tools=tools,
            tool_choice=tool_choice,
            max_tokens=self.max_tokens,
        )
        yield message_to_generate_content_response(message)

    @cached_property
    def _anthropic_client(self) -> Anthropic:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY environment variable must be set for using"
                " Claude with Anthropic's direct API."
            )

        return Anthropic(api_key=api_key)

