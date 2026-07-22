## Feature backlog

~~1. (admin) It should be possible to add 2 different kids with a single email (siblings, mom is having the email)~~
~~2. (admin) it should be possible to mass load the group of the kids or the whole course~~
~~3. (admin) when I create the lesson and assign the course, there are no kids/moms inside!~~
4. (admin) whenever I want to assign a course to a lesson - if there is not enough room left for the whole group, there
   has to be a dialog for resolving this - preferably selecting the specific kids which should be added.
   ~~5. The logo top left corner has to be the tiger - ask about the png file when you are dealing with this task.~~

## Backlog from repository health check (2026-07-03)

### Tier 4 — Lower (maintainability, no direct exploit)

17. Introduce typed row mappers at the DB boundary: DAOs return untyped libSQL rows and consumers re-cast
    field-by-field (~145 `as` casts confirmed across server.ts and registration-db.ts, some of which are unrelated
    param/const casts), so strict TypeScript is effectively disabled at the data layer and column renames break nothing
    at compile time. Large multi-day refactor.
17. Introduce a real migration system with version tracking; the current boot-time `try { ALTER TABLE } catch {}`
    migrations (database.ts:190–257) swallow real errors and can never be safely removed. **PARTIALLY DONE:** all four
    completed legacy migrations (`migrateAgeGroups`, `migrateLocationToCourses`, `migrateDropParticipantCourseId`,
    `migrateAddProgramIdToCourses`) were verified safe against production Turso and removed — they were permanent no-ops
    and one was also causing an IDE static-analysis false positive ("Unable to resolve column 'location'"). **Still
    open:** no versioned migration system exists yet; any future schema change still needs the same boot-time try/catch
    pattern.
22. Add minimal production observability: error monitoring (e.g. Sentry free tier — currently the only failure signal is
    Render logs or a customer complaint) and a scheduled run of the smoke-login.yml workflow. Also note the live email
    path is untested: Playwright forces the NoOp transport and the live-SMTP spec is fully skipped.

