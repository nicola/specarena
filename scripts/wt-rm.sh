#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
force_flag="${2:-}"

if [[ -z "$target" ]]; then
  echo "Usage: npm run wt:rm -- <task-slug-or-path> [--force]"
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
repo_name="$(basename "$repo_root")"
worktree_home="${WORKTREE_HOME:-$(dirname "$repo_root")/${repo_name}-wt}"

if [[ -d "$target" ]]; then
  worktree_path="$target"
else
  worktree_path="${worktree_home}/${target}"
fi

if [[ ! -d "$worktree_path" ]]; then
  echo "Worktree directory not found: $worktree_path" >&2
  exit 1
fi

if [[ "$force_flag" == "--force" ]]; then
  git worktree remove --force "$worktree_path"
else
  git worktree remove "$worktree_path"
fi

git worktree prune
echo "Removed and pruned: $worktree_path"
