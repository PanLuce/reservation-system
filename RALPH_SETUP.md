# Ralph Loop Manual Setup

This repository now has Ralph Loop configured for iterative AI development.

## What is Ralph Loop?

Ralph Loop is an iterative development technique where you:
1. Write a clear prompt with completion criteria
2. Run the loop script
3. The AI works on the task repeatedly until done
4. Each iteration sees previous work and improves

## Files Created

- `ralph.sh` - Full automation (runs Claude Code in loop)
- `ralph-interactive.sh` - Interactive mode (for use within Claude Code)
- `prompt.example.md` - Example prompt template
- `RALPH_SETUP.md` - This file

## Usage

### Method 1: Automated Loop (External)

Run Ralph from outside Claude Code:

```bash
# 1. Create your prompt file
cp prompt.example.md prompt.md
# Edit prompt.md with your task

# 2. Run ralph loop
./ralph.sh prompt.md 50 COMPLETE

# Arguments:
# - prompt.md: Your prompt file
# - 50: Max iterations
# - COMPLETE: Word that signals completion
```

### Method 2: Interactive Mode (Within Claude Code)

Use this when already in a Claude Code session:

```bash
# 1. Create your prompt file
cp prompt.example.md my-task.md
# Edit my-task.md with your task

# 2. Run interactive script
./ralph-interactive.sh my-task.md

# 3. Tell Claude: "Please execute this task iteratively using the ralph loop pattern"
```

### Method 3: Manual (No Scripts)

Just tell Claude directly:

```
I want you to work iteratively on this task until completion:

[Your task description]

Instructions:
1. Work on the task
2. Run tests/verify your work
3. If not done, analyze what needs improvement
4. Continue iterating
5. Output <promise>COMPLETE</promise> when done

Max iterations: 50
```

## Writing Good Prompts

### Essential Elements

1. **Clear Success Criteria**
   ```markdown
   Output <promise>COMPLETE</promise> when:
   - All tests passing
   - Coverage > 80%
   - No linter errors
   ```

2. **Incremental Steps**
   ```markdown
   Phase 1: Setup (models, types)
   Phase 2: Core logic
   Phase 3: Tests
   Phase 4: Documentation
   ```

3. **Self-Correction Instructions**
   ```markdown
   On each iteration:
   1. Run tests
   2. If failures, debug and fix
   3. Commit changes
   4. Run tests again
   5. Continue until all pass
   ```

4. **Safety Net**
   ```markdown
   If stuck after 15 iterations:
   - Document blockers
   - List what was tried
   - Suggest alternatives
   ```

### Example Prompt Structure

```markdown
# Task: [Clear title]

## Requirements
- Requirement 1
- Requirement 2
- Requirement 3

## Success Criteria
When ALL true, output: <promise>COMPLETE</promise>
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Iteration Instructions
1. Step to do
2. How to verify
3. What to do if it fails
4. When to move to next step

## Escape Hatch
If not complete after 15 iterations:
- Document progress
- List blockers
- Suggest next steps
```

## Tips for Success

1. **Be Specific**: Vague prompts → vague results
2. **Include Verification**: Tests, linters, type checks
3. **Set Limits**: Always use max iterations
4. **Log Everything**: Check `ralph-loop.log` for debugging
5. **Start Small**: Test with simple tasks first

## Example Tasks Good for Ralph

✅ **Good:**
- "Implement CRUD API with tests"
- "Fix all TypeScript errors in the codebase"
- "Add authentication with JWT and tests"
- "Refactor component to use hooks and pass all tests"

❌ **Not Good:**
- "Make it better" (too vague)
- "Design a new feature" (needs human judgment)
- "Debug production issue" (needs targeted approach)

## Monitoring Progress

```bash
# Watch the log file
tail -f ralph-loop.log

# Check iteration count
grep "Iteration" ralph-loop.log | wc -l

# See if completion was detected
grep "COMPLETION DETECTED" ralph-loop.log
```

## Stopping Ralph

```bash
# Kill the process
Ctrl+C

# Or find and kill by name
pkill -f ralph.sh
```

## Philosophy

1. **Iteration > Perfection**: Don't expect perfect on first try
2. **Failures Are Data**: Use them to improve the prompt
3. **Operator Skill Matters**: Good prompts = good results
4. **Persistence Wins**: Keep iterating until success

## Troubleshooting

**Problem**: Loop never completes
- **Fix**: Check if completion word matches exactly
- **Fix**: Reduce scope of task
- **Fix**: Add more specific success criteria

**Problem**: Gets stuck in infinite loop
- **Fix**: Lower max iterations
- **Fix**: Add more detailed self-correction instructions
- **Fix**: Break task into smaller phases

**Problem**: Output too verbose
- **Fix**: Add to prompt: "Be concise in output"
- **Fix**: Redirect to file: `./ralph.sh prompt.md 50 COMPLETE > output.log`

## Learn More

- Original technique: https://ghuntley.com/ralph/
- Y Combinator results: Used to generate 6 repos overnight
- Real-world: $50k contract for $297 in API costs

## Next Steps

1. Copy `prompt.example.md` to create your first prompt
2. Start with a simple task to test the setup
3. Iterate on your prompt writing skills
4. Scale up to larger tasks

Happy Ralph Looping! 🔄
