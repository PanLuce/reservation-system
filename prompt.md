# Ralph Prompt

Use claude plan mode for Phases 1.
Use claude normal mode (auto-accept edits) for the rest of the Phases.
Use TypeScript language.
Use Playwright for testing.
Implement step-by-step, smallest task at a time.
The reservation system needs to be integrated with my wordpress web administration in the end.
Check my web: https://centrumrubacek.cz/lekce-a-krouzky/
This reservation system is to substitute the current inconvenient system SuperSaas:https://www.supersaas.com/info/doc/integration/wordpress_integration (check for functionality but don't copy paste features one-by-one)

Build a reservation system with the following requirements:

## Phase 1: SKILLS and setup of the project
- [ ] for the following task check the SKILLS folder in order to pick the right skill, display the selected one
- [ ] install necessary tools for proper testing and linting
- [ ] use TDD approach for the following implementation tasks 

## Phase 2: reservation basics
- [x] build the calendar with lessons for exercise
- [ ] lessons can be edited by bulk
- [ ] admin can register participant on their behalf (also bulk operations)
- [x] such distribution of the participants can be loaded via excel spreadsheet
- [ ] let participants sign to lessons - as substitution for missed lessons
- [ ] introduce proper login into the system (also for the participants and myself as admin) 
- [ ] introduce different view for each login (participant vs admin) - participants can ONLY sign in for their own lesson (with their name and child)  
- [ ] participants can select even full lessons in order to indicate that they stand in as substitute for possibly absent moms in the future (for me as admin to manage this later on)

## Completion Criteria

When ALL of the following are true, output: <promise>COMPLETE</promise>

- All basics implemented
- All validations working
- All tests passing
- Test coverage > 80%
- Code follows clean code principles

## Self-Correction Instructions

On each iteration:
1. Run tests
2. If any fail, analyze the error
3. Fix the issue
4. Commit the fix
5. Run tests again
6. Repeat until all pass
7. Check UI locally

If stuck after 15 iterations:
- Document the blocker
- List what was attempted
- Suggest alternative approaches
