"""Legacy module — re-exports the CLI-based client for backwards compatibility.

The pipeline originally targeted the Anthropic API SDK directly. We've switched to
the local `claude` CLI (subscription-based auth) so users don't need an API key.
The CLI client implements the same `call_with_images()` and `cost_summary()`
interface, so all stage modules continue to work unchanged.
"""
from __future__ import annotations
from .cli_client import ClaudeCLIClient as RateLimitedClient
from .cli_client import parse_json_response

__all__ = ["RateLimitedClient", "parse_json_response"]
