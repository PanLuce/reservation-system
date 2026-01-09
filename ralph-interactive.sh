#!/bin/bash

# Interactive Ralph Loop for Claude Code
# This keeps the session open and feeds the prompt repeatedly

PROMPT_FILE="${1:-prompt.md}"
MAX_ITERATIONS="${2:-50}"
ITERATION=0

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: Prompt file '$PROMPT_FILE' not found"
  exit 1
fi

echo "🔄 Ralph Interactive Loop"
echo "📄 Reading prompt from: $PROMPT_FILE"
echo "🔢 Max iterations: $MAX_ITERATIONS"
echo ""
echo "Instructions for Claude:"
echo "1. Read the prompt from $PROMPT_FILE"
echo "2. Work on the task iteratively, git commit and push with short descriptime commit message after each iteration with passing tests and lint"
echo "3. After each attempt, read $PROMPT_FILE again and continue"
echo "4. Output <promise>COMPLETE</promise> when done"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat "$PROMPT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
