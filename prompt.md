# Ralph Prompt

Use claude plan mode for Phases 1.
Use claude normal mode (auto-accept edits) for the rest of the Phases.
Use TypeScript language.
Use Playwright for testing.
Implement step-by-step, smallest task at a time.
The reservation system needs to be integrated with my wordpress web administration in the end.
Check my web: https://centrumrubacek.cz/lekce-a-krouzky/
This reservation system is to substitute the current inconvenient system SuperSaas:https://www.supersaas.com/info/doc/integration/wordpress_integration (check for functionality but don't copy paste features one-by-one)
Use TDD approach for the following implementation tasks.
For the following task check the SKILLS folder in order to pick the right skill, display the selected one.

Build a reservation system with the following requirements:

## Phase 1: formulář
- [ ] vyplní rezervační formulář
- [ ] přijde email mi i přihlášenému

## Phase 2: rozvrh
- [ ] Přihlášení osoby přes email do rozvrhu - vytvoří si své heslo
- [ ] Osoba jde přiřadit do skupiny (kurzu - rozdělit i barevně)
- [ ] Do rozvrhu přidám hromadně 10 lekcí z jednoho kurzu
- [ ] Do kurzu (10 lekcí) přidám hromadně celou skupinu 10 lidí
- [ ] Každý email (osoba) vidí své rezervace (datum, čas, počet osob na lekci, poznámku pro koho je cvičení (věk))
- [ ] Osoba se může sama odhlásit z lekce a přihlásit se do jiné (ideálně jen do své věkové kategorie)
- [ ] Já (admin) můžu přihlásit nebo odhlásit jakoukoliv osobu kamkoliv a kdykoliv
- [x] Osoby se můžou z lekce odhlásit nejpozději do půlnoci před lekcí.
- [ ] Každá osoba má u svého "profilu" zobrazen počet NÁHRAD - (podle toho z kolika lekci se včas odhlásil) - nebo jsem ho po omluvení odhlásila já (číslo lze měnit adminem).
- [ ] Já mohu kdykoliv prodloužit nebo zkrátit časovou platnost náhrad.
- [ ] Náhrada za lekci má platnost 3 měsíce

## Phase 3: platba
- [ ] SPÁROVÁNÍ S PLATBOU - optional (leave as the last point)


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
