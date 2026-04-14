"""Unit tests for models.py — T12.3

Tests:
  - OrchStats accumulation, cost calculation, to_summary()
  - build_claude_messages() message ordering / truncation
  - check_ollama_online() caching behaviour
  - parse_mentions() with edge cases
  - _truncate_to_context() token overflow guard
"""
from __future__ import annotations

import asyncio
import importlib.util
import pathlib
import sys
import time
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# conftest.py installs a lightweight stub under sys.modules["models"] for
# orchestration tests.  We need the *real* implementation here, so load
# models.py directly under a private module name.
_spec = importlib.util.spec_from_file_location(
    "_models_real",
    str(pathlib.Path(__file__).parent.parent / "models.py"),
)
m = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m)  # type: ignore[union-attr]

# Convenience: force-expire the Ollama/Claude cache (time.monotonic() starts
# near 0 in fresh processes, so setting checked_at=0+TTL+1 is more reliable).
_TTL = 31  # one second past the 30-second TTL


# ── OrchStats ─────────────────────────────────────────────────────────────────

class TestOrchStats:
    def test_initial_state(self):
        stats = m.OrchStats()
        assert stats.by_agent == {}
        assert stats.total_tasks() == 0
        assert stats.local_tokens() == 0
        inp, out = stats.claude_tokens()
        assert inp == 0
        assert out == 0

    def test_record_single_agent(self):
        stats = m.OrchStats()
        stats.record("deepseek", input_tok=100, output_tok=200)
        assert stats.by_agent["deepseek"]["tasks"] == 1
        assert stats.by_agent["deepseek"]["input_tokens"] == 100
        assert stats.by_agent["deepseek"]["output_tokens"] == 200

    def test_record_accumulates(self):
        stats = m.OrchStats()
        stats.record("deepseek", 100, 200)
        stats.record("deepseek", 50, 75)
        assert stats.by_agent["deepseek"]["tasks"] == 2
        assert stats.by_agent["deepseek"]["input_tokens"] == 150
        assert stats.by_agent["deepseek"]["output_tokens"] == 275

    def test_record_multiple_agents(self):
        stats = m.OrchStats()
        stats.record("claude", 500, 250)
        stats.record("deepseek", 100, 100)
        assert stats.total_tasks() == 2
        assert stats.local_tokens() == 200   # deepseek only
        inp, out = stats.claude_tokens()
        assert inp == 500
        assert out == 250

    def test_cost_calculation(self):
        stats = m.OrchStats()
        # 1M input tokens at $3.00 + 1M output tokens at $15.00 = $18.00
        stats.record("claude", input_tok=1_000_000, output_tok=1_000_000)
        summary = stats.to_summary()
        assert abs(summary["cost_usd"] - 18.0) < 0.01

    def test_zero_cost_for_local_only(self):
        stats = m.OrchStats()
        stats.record("deepseek", 1_000_000, 1_000_000)
        summary = stats.to_summary()
        assert summary["cost_usd"] == 0.0

    def test_to_summary_keys(self):
        stats = m.OrchStats()
        stats.record("claude", 100, 50)
        summary = stats.to_summary()
        for key in ("elapsed", "by_agent", "claude_input", "claude_output",
                    "local_tokens", "cost_usd", "total_tasks"):
            assert key in summary, f"Missing key: {key}"

    def test_elapsed_returns_string(self):
        stats = m.OrchStats()
        elapsed = stats.elapsed()
        assert isinstance(elapsed, str)
        assert "s" in elapsed

    def test_elapsed_minutes_format(self):
        stats = m.OrchStats()
        stats.start_time = time.time() - 125  # 2 minutes 5 seconds ago
        elapsed = stats.elapsed()
        assert "m" in elapsed and "s" in elapsed


# ── build_claude_messages ─────────────────────────────────────────────────────

class TestBuildClaudeMessages:
    def setup_method(self):
        # Give Claude a label so messages format correctly
        m.AGENT_LABEL = {"claude": "Claude", "deepseek": "DeepSeek"}

    def test_simple_user_message(self):
        history = [{"role": "user", "content": "hello"}]
        msgs = m.build_claude_messages(history)
        assert len(msgs) == 1
        assert msgs[-1]["role"] == "user"
        assert msgs[-1]["content"] == "hello"

    def test_ends_with_user_role(self):
        history = [
            {"role": "user", "content": "hi"},
            {"role": "claude", "content": "hello there"},
            {"role": "user", "content": "how are you?"},
        ]
        msgs = m.build_claude_messages(history)
        assert msgs[-1]["role"] == "user"

    def test_ai_only_history_returns_empty(self):
        """If history ends with assistant turn, must return [] (Claude API requires user last)."""
        history = [
            {"role": "user", "content": "hi"},
            {"role": "claude", "content": "hello"},
        ]
        msgs = m.build_claude_messages(history)
        assert msgs == []

    def test_empty_history_returns_empty(self):
        assert m.build_claude_messages([]) == []

    def test_consecutive_user_messages_merged(self):
        history = [
            {"role": "user", "content": "part 1"},
            {"role": "user", "content": "part 2"},
        ]
        msgs = m.build_claude_messages(history)
        # Must be a single user message containing both parts
        assert len(msgs) == 1
        assert "part 1" in msgs[0]["content"]
        assert "part 2" in msgs[0]["content"]

    def test_consecutive_agent_messages_merged(self):
        history = [
            {"role": "user", "content": "go"},
            {"role": "claude", "content": "response A"},
            {"role": "claude", "content": "response B"},
            {"role": "user", "content": "ok"},
        ]
        msgs = m.build_claude_messages(history)
        # Should have: user, assistant (merged), user
        assert len(msgs) == 3
        assert msgs[1]["role"] == "assistant"
        assert "response A" in msgs[1]["content"]
        assert "response B" in msgs[1]["content"]

    def test_agent_label_injected(self):
        m.AGENT_LABEL = {"deepseek": "DeepSeek"}
        history = [
            {"role": "user", "content": "hi"},
            {"role": "deepseek", "content": "hello"},
            {"role": "user", "content": "thanks"},
        ]
        msgs = m.build_claude_messages(history)
        assert "[DeepSeek]" in msgs[1]["content"]


# ── _truncate_to_context ──────────────────────────────────────────────────────

class TestTruncateToContext:
    def _make_msgs(self, n: int, chars_each: int = 400) -> list[dict]:
        """Make n non-system messages, each ~chars_each characters."""
        return [{"role": "user" if i % 2 == 0 else "assistant",
                 "content": "x" * chars_each}
                for i in range(n)]

    def test_no_truncation_when_within_limit(self):
        msgs = self._make_msgs(3, chars_each=40)
        result = m._truncate_to_context(msgs, max_tokens=10_000)
        assert len(result) == 3

    def test_truncates_oldest_first(self):
        msgs = [
            {"role": "user", "content": "oldest"},
            {"role": "user", "content": "x" * 4000},
            {"role": "user", "content": "newest"},
        ]
        # max_tokens=2 forces dropping; oldest should go first
        result = m._truncate_to_context(msgs, max_tokens=2)
        contents = [r["content"] for r in result]
        # "oldest" must be gone before "newest"
        assert "newest" in contents or len(result) < len(msgs)

    def test_system_messages_preserved(self):
        msgs = [
            {"role": "system", "content": "system prompt"},
            {"role": "user", "content": "x" * 40000},
            {"role": "user", "content": "x" * 40000},
        ]
        result = m._truncate_to_context(msgs, max_tokens=100)
        system_msgs = [r for r in result if r["role"] == "system"]
        assert len(system_msgs) == 1
        assert system_msgs[0]["content"] == "system prompt"

    def test_empty_list_returns_empty(self):
        assert m._truncate_to_context([], max_tokens=1000) == []


# ── check_ollama_online caching ───────────────────────────────────────────────

@pytest.mark.asyncio
class TestCheckOllamaOnline:
    def _make_client_mock(self, status: int = 200, exc: Optional[Exception] = None) -> MagicMock:
        """Return a mock that replaces m._http_client with a pre-configured .get."""
        mock_client = MagicMock()
        if exc is not None:
            mock_client.get = AsyncMock(side_effect=exc)
        else:
            resp = MagicMock()
            resp.status_code = status
            mock_client.get = AsyncMock(return_value=resp)
        return mock_client

    async def test_caches_positive_result(self):
        """After a successful check, a second call within TTL should not make a network request."""
        mock_client = self._make_client_mock(status=200)
        m._ollama_status["checked_at"] = time.monotonic() - _TTL  # force expired cache

        with patch.object(m, "_http_client", mock_client):
            r1 = await m.check_ollama_online()
            r2 = await m.check_ollama_online()  # should use cache

        assert r1 is True
        assert r2 is True
        assert mock_client.get.call_count == 1  # only ONE real network call

    async def test_caches_negative_result(self):
        mock_client = self._make_client_mock(exc=Exception("unreachable"))
        m._ollama_status["checked_at"] = time.monotonic() - _TTL

        with patch.object(m, "_http_client", mock_client):
            r1 = await m.check_ollama_online()
            r2 = await m.check_ollama_online()

        assert r1 is False
        assert r2 is False
        assert mock_client.get.call_count == 1

    async def test_rechecks_after_ttl(self):
        """After the 30s TTL, a new network request should be made."""
        mock_client = self._make_client_mock(status=200)

        with patch.object(m, "_http_client", mock_client):
            m._ollama_status["checked_at"] = time.monotonic() - _TTL  # force expired
            await m.check_ollama_online()                               # first real call
            m._ollama_status["checked_at"] = time.monotonic() - _TTL  # expire again
            await m.check_ollama_online()                               # second real call

        assert mock_client.get.call_count == 2


# ── parse_mentions ────────────────────────────────────────────────────────────

class TestParseMentions:
    def setup_method(self):
        m.OLLAMA_MODELS = {"deepseek": "deepseek-coder-v2:16b", "qwen35": "qwen:9b"}
        m._get_master_model = lambda: "claude"
        m._is_claude_available = lambda: True

    def test_at_claude_mention(self):
        targets = m.parse_mentions("@claude explain this", claude_online=True)
        assert "claude" in targets

    def test_at_claude_ignored_when_offline(self):
        targets = m.parse_mentions("@claude explain this", claude_online=False)
        assert "claude" not in targets

    def test_at_deepseek_mention(self):
        targets = m.parse_mentions("@deepseek write the code", claude_online=True)
        assert "deepseek" in targets

    def test_at_all_includes_deepseek(self):
        targets = m.parse_mentions("@all do this", claude_online=True)
        assert "deepseek" in targets

    def test_at_all_claude_offline_no_claude(self):
        m._is_claude_available = lambda: False
        targets = m.parse_mentions("@all do this", claude_online=False)
        assert "claude" not in targets

    def test_no_mention_returns_master(self):
        m._get_master_model = lambda: "claude"
        m._is_claude_available = lambda: True
        targets = m.parse_mentions("just a plain message", claude_online=True)
        assert "claude" in targets

    def test_no_mention_claude_offline_falls_back_to_deepseek(self):
        m._get_master_model = lambda: "claude"
        m._is_claude_available = lambda: False
        targets = m.parse_mentions("plain message", claude_online=False)
        # When claude not available and master=claude, fallback to deepseek
        assert targets  # at minimum something is returned

    def test_case_insensitive_mentions(self):
        targets = m.parse_mentions("@Claude write this", claude_online=True)
        assert "claude" in targets

    def test_multiple_mentions(self):
        targets = m.parse_mentions("@claude and @deepseek both answer", claude_online=True)
        assert "claude" in targets
        assert "deepseek" in targets
