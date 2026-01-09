#!/bin/bash

# Ralph Loop - Iterative AI Development Loop
# Usage: ./ralph.sh <prompt-file> [max-iterations] [completion-word]

PROMPT_FILE="${1:-prompt.md}"
MAX_ITERATIONS="${2:-100}"
COMPLETION_WORD="${3:-COMPLETE}"
ITERATION=0

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: Prompt file '$PROMPT_FILE' not found"
  exit 1
fi

echo "🔄 Ralph Loop Starting"
echo "📄 Prompt: $PROMPT_FILE"
echo "🔢 Max iterations: $MAX_ITERATIONS"
echo "✅ Completion word: $COMPLETION_WORD"
echo ""

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔁 Iteration $ITERATION/$MAX_ITERATIONS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Feed the prompt to Claude Code
  OUTPUT=$(claude code --message "$(cat $PROMPT_FILE)" 2>&1)

  # Log the output
  echo "$OUTPUT"
  echo "$OUTPUT" >> ralph-loop.log

  # Check for completion
  if echo "$OUTPUT" | grep -q "$COMPLETION_WORD"; then
    echo ""
    echo "✅ COMPLETION DETECTED!"
    echo "🎉 Task completed in $ITERATION iterations"
    exit 0
  fi

  # Brief pause between iterations
  sleep 2
done

echo ""
echo "⚠️  Max iterations ($MAX_ITERATIONS) reached without completion"
echo "📋 Check ralph-loop.log for full output"
exit 1
