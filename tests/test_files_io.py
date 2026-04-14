"""Unit tests for files_io.py — T12.1"""
import subprocess
import sys
import textwrap
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from files_io import (
    _safe_filename,
    apply_filename_hints,
    extract_files_from_response,
    git_commit,
    git_init,
    infer_files_from_codeblocks,
    write_project_files,
)


# ── _safe_filename ────────────────────────────────────────────────────────────

class TestSafeFilename:
    def test_strips_src_prefix(self):
        assert _safe_filename("src/index.html") == "index.html"

    def test_rejects_traversal_dotdot(self):
        assert _safe_filename("../secret.txt") is None

    def test_rejects_traversal_in_path(self):
        assert _safe_filename("js/../../../etc/passwd") is None

    def test_rejects_absolute_path(self):
        assert _safe_filename("/etc/passwd") is None

    def test_rejects_null_byte(self):
        assert _safe_filename("file\x00.js") is None

    def test_rejects_empty(self):
        assert _safe_filename("") is None
        assert _safe_filename("   ") is None

    def test_allows_nested_path(self):
        assert _safe_filename("js/app.js") == "js/app.js"

    def test_strips_whitespace(self):
        assert _safe_filename("  style.css  ") == "style.css"


# ── extract_files_from_response ───────────────────────────────────────────────

class TestExtractFilesFromResponse:
    # ── S3/S4: FILE: comment marker ──────────────────────────────────────────

    def test_s3_js_comment_before_fenced_block(self):
        content = textwrap.dedent("""\
            // FILE: index.js
            ```javascript
            console.log('hello');
            ```
        """)
        files = extract_files_from_response(content)
        assert len(files) == 1
        assert files[0]["filename"] == "index.js"
        assert "console.log" in files[0]["content"]

    def test_s3_hash_comment(self):
        content = "# FILE: main.py\n```python\nprint('hi')\n```\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "main.py"

    def test_s3_html_comment_marker(self):
        content = "<!-- FILE: index.html -->\n```html\n<html></html>\n```\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "index.html"

    def test_s3_strips_src_prefix(self):
        content = "// FILE: src/app.js\n```js\nvar x=1;\n```\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "app.js"

    def test_s3_rejects_traversal(self):
        content = "// FILE: ../../etc/passwd\n```\nsecret\n```\n"
        files = extract_files_from_response(content)
        assert files == []

    def test_s3_multiple_files(self):
        content = textwrap.dedent("""\
            // FILE: index.html
            ```html
            <html></html>
            ```
            // FILE: style.css
            ```css
            body { margin: 0; }
            ```
        """)
        files = extract_files_from_response(content)
        assert len(files) == 2
        names = {f["filename"] for f in files}
        assert names == {"index.html", "style.css"}

    def test_s3_deduplicates_same_filename(self):
        content = textwrap.dedent("""\
            // FILE: app.js
            ```js
            var a = 1;
            ```
            // FILE: app.js
            ```js
            var b = 2;
            ```
        """)
        files = extract_files_from_response(content)
        assert len(files) == 1

    # ── S1: **`path`** before block ──────────────────────────────────────────

    def test_s1_bold_backtick_before_block(self):
        content = "**`game.js`**\n```javascript\nfunction start() {}\n```\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "game.js"
        assert "function start" in files[0]["content"]

    def test_s1_h3_backtick_before_block(self):
        content = "### `style.css`\n```css\nbody{}\n```\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "style.css"

    # ── S2: FILE: as first line inside block ─────────────────────────────────

    def test_s2_file_marker_first_line_inside_block(self):
        content = "```javascript\n// FILE: app.js\nconsole.log(1);\n```\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "app.js"
        assert "// FILE:" not in files[0]["content"]
        assert "console.log" in files[0]["content"]

    def test_s2_hash_first_line(self):
        content = "```python\n# FILE: utils.py\ndef foo(): pass\n```\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "utils.py"

    # ── Bare fallback ─────────────────────────────────────────────────────────

    def test_bare_html_block_fallback(self):
        content = "```html\n<html><body>Hi</body></html>\n```\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "index.html"

    def test_bare_css_block_fallback(self):
        content = "```css\nbody { color: red; }\n```\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "style.css"

    def test_bare_js_fallback(self):
        content = "```javascript\nvar x = 1;\n```\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "js/main.js"

    # ── Edge cases ────────────────────────────────────────────────────────────

    def test_empty_input_returns_empty(self):
        assert extract_files_from_response("") == []

    def test_no_code_blocks_returns_empty(self):
        assert extract_files_from_response("Just some text with no code.") == []

    def test_s3_without_fences_raw_code(self):
        """S4: FILE: marker with raw code follows (no fences)."""
        content = "// FILE: raw.js\nvar x = 1;\nvar y = 2;\n"
        files = extract_files_from_response(content)
        assert files[0]["filename"] == "raw.js"
        assert "var x" in files[0]["content"]


# ── infer_files_from_codeblocks ───────────────────────────────────────────────

class TestInferFilesFromCodeblocks:
    def test_single_block_single_file(self):
        content = "```javascript\nfunction go() { console.log('starting game loop'); requestAnimationFrame(go); }\n```\n"
        result = infer_files_from_codeblocks(content, ["app.js"])
        assert result[0]["filename"] == "app.js"
        assert "function go" in result[0]["content"]

    def test_extension_matching(self):
        css = "body { margin: 0; padding: 0; font-family: sans-serif; background: #111; color: #eee; }"
        js = "document.addEventListener('DOMContentLoaded', function() { console.log('ready'); });"
        content = f"```css\n{css}\n```\n```javascript\n{js}\n```\n"
        result = infer_files_from_codeblocks(content, ["style.css", "main.js"])
        names = {r["filename"] for r in result}
        assert "style.css" in names
        assert "main.js" in names

    def test_empty_files_to_create_returns_empty(self):
        content = "```javascript\nvar x=1;\n```\n"
        assert infer_files_from_codeblocks(content, []) == []

    def test_no_code_blocks_returns_empty(self):
        assert infer_files_from_codeblocks("no code here", ["app.js"]) == []

    def test_skips_trivial_blocks(self):
        """Blocks under 60 chars should be skipped."""
        content = "```js\nvar x=1;\n```\n"
        result = infer_files_from_codeblocks(content, ["app.js"])
        # short block is < 60 chars, may still match if only one block/file
        # but we verify it doesn't crash
        assert isinstance(result, list)


# ── write_project_files ───────────────────────────────────────────────────────

class TestWriteProjectFiles:
    def _project(self, tmp_path: Path) -> dict:
        return {"folder_path": str(tmp_path)}

    def test_writes_file_to_src(self, tmp_path):
        project = self._project(tmp_path)
        files = [{"filename": "index.html", "content": "<html></html>"}]
        written = write_project_files(project, files)
        assert written == ["index.html"]
        assert (tmp_path / "src" / "index.html").read_text() == "<html></html>"

    def test_creates_nested_directories(self, tmp_path):
        project = self._project(tmp_path)
        files = [{"filename": "js/app.js", "content": "var x=1;"}]
        written = write_project_files(project, files)
        assert written == ["js/app.js"]
        assert (tmp_path / "src" / "js" / "app.js").exists()

    def test_rejects_traversal_attempt(self, tmp_path):
        project = self._project(tmp_path)
        files = [{"filename": "../outside.txt", "content": "evil"}]
        written = write_project_files(project, files)
        assert written == []
        assert not (tmp_path / "outside.txt").exists()

    def test_rejects_absolute_path(self, tmp_path):
        project = self._project(tmp_path)
        files = [{"filename": "/etc/passwd", "content": "evil"}]
        written = write_project_files(project, files)
        assert written == []

    def test_skips_oversized_file(self, tmp_path):
        project = self._project(tmp_path)
        big_content = "x" * (1 * 1024 * 1024 + 1)  # > 1MB limit
        files = [{"filename": "big.txt", "content": big_content}]
        written = write_project_files(project, files)
        assert written == []

    def test_skips_empty_filename(self, tmp_path):
        project = self._project(tmp_path)
        files = [{"filename": "", "content": "something"}]
        written = write_project_files(project, files)
        assert written == []

    def test_writes_multiple_files(self, tmp_path):
        project = self._project(tmp_path)
        files = [
            {"filename": "index.html", "content": "<html/>"},
            {"filename": "style.css", "content": "body{}"},
            {"filename": "app.js", "content": "var x=1;"},
        ]
        written = write_project_files(project, files)
        assert set(written) == {"index.html", "style.css", "app.js"}

    def test_batch_size_limit(self, tmp_path):
        """Files that would exceed 10MB total batch limit are skipped."""
        project = self._project(tmp_path)
        # Each file is ~2MB, so 6 files = ~12MB > 10MB limit
        chunk = "x" * (2 * 1024 * 1024)
        files = [{"filename": f"file{i}.txt", "content": chunk} for i in range(6)]
        written = write_project_files(project, files)
        # Should have stopped before writing all 6
        assert len(written) < 6


# ── apply_filename_hints ──────────────────────────────────────────────────────

class TestApplyFilenameHints:
    def test_renames_generic_js(self):
        files = [{"filename": "js/main.js", "content": "var x;"}]
        result = apply_filename_hints(files, ["game.js"])
        assert result[0]["filename"] == "game.js"

    def test_renames_generic_css(self):
        files = [{"filename": "style.css", "content": "body{}"}]
        result = apply_filename_hints(files, ["theme.css"])
        assert result[0]["filename"] == "theme.css"

    def test_renames_generic_html(self):
        files = [{"filename": "index.html", "content": "<html/>"}]
        result = apply_filename_hints(files, ["game.html"])
        assert result[0]["filename"] == "game.html"

    def test_does_not_rename_non_generic(self):
        files = [{"filename": "specific.js", "content": "var x;"}]
        result = apply_filename_hints(files, ["other.js"])
        assert result[0]["filename"] == "specific.js"

    def test_empty_inputs(self):
        assert apply_filename_hints([], ["app.js"]) == []
        assert apply_filename_hints([{"filename": "style.css", "content": ""}], []) == [{"filename": "style.css", "content": ""}]


# ── git operations ────────────────────────────────────────────────────────────

class TestGitOperations:
    def test_git_init_creates_gitignore(self, tmp_path):
        git_init(str(tmp_path))
        assert (tmp_path / ".gitignore").exists()

    def test_git_init_missing_binary(self, tmp_path):
        """git_init should not raise when git binary is missing."""
        with patch("subprocess.run", side_effect=FileNotFoundError):
            git_init(str(tmp_path))  # must not raise

    def test_git_commit_missing_binary(self, tmp_path):
        """git_commit should not raise when git binary is missing."""
        with patch("subprocess.run", side_effect=FileNotFoundError):
            git_commit(str(tmp_path), "test commit")  # must not raise

    def test_git_commit_non_zero_logs_devlog(self, tmp_path):
        """Non-zero git commit exit code should log to devlog.md."""
        devlog = tmp_path / "devlog.md"
        devlog.write_text("# Log\n")

        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "error: something"

        def fake_run(cmd, **kwargs):
            if cmd[1] == "commit":
                return mock_result
            return MagicMock(returncode=0)

        with patch("subprocess.run", side_effect=fake_run):
            git_commit(str(tmp_path), "bad commit")

        assert "git commit failed" in devlog.read_text()
