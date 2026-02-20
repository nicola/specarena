#!/usr/bin/env bash
set -euo pipefail

slug="${1:-}"

if [[ -z "$slug" ]]; then
  echo "Usage: npm run wt:new -- <task-slug> [branch-name] [base-ref]"
  echo "Example: npm run wt:new -- chat-sync-timeout"
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
repo_name="$(basename "$repo_root")"
worktree_home="${WORKTREE_HOME:-$(dirname "$repo_root")/${repo_name}-wt}"
branch="${2:-task/$slug}"
base_ref="${3:-origin/main}"
worktree_path="${worktree_home}/${slug}"

if [[ -e "$worktree_path" ]]; then
  echo "Worktree path already exists: $worktree_path" >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$branch"; then
  echo "Local branch already exists: $branch" >&2
  echo "Pick a different slug/branch, or delete that branch before retrying." >&2
  exit 1
fi

mkdir -p "$worktree_home"

if [[ "$base_ref" == origin/* ]]; then
  git fetch origin
fi

git worktree add "$worktree_path" -b "$branch" "$base_ref"

echo ""
echo "Worktree created:"
echo "  Path:   $worktree_path"
echo "  Branch: $branch"
echo ""
echo "Next steps:"
echo "  cd \"$worktree_path\""
echo "  npm install"
echo "  codex"
