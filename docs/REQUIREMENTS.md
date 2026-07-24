## Feature backlog

~~1. Whenever I create new "kurz" or editing "skupinku" or "lesson" the screen stays in edit or create new mode even
though I navigate to different tab. Ask for a screenshot once tackling this.~~
~~2. Waitlisting participant - whenever participant is waitlisted, and subsequently the space is emptied, the first
   participant should be placed there to fill the space AND email is sent to him informing about it, leaving an option
to decline the assignment to the lesson.~~
3. add participants is not working properly: when I look at the lesson it shows 12/15 capacity, however when I look at
   the lesson detail it lists NO kids there. Furthermore, when I add 1 kid, he is listed but the counter still shows
   12/15 and the others are not listed still. Ask for screenshots for this issue.
4. There are number of "in progress" screens which are waiting for data or a process to finish. One example is login
   screen. But there is no UX mechanism to inform the user to not do anything and wait (e.g. gray UI, disable buttons,
   any other proposal). I have a screenshot so ask for it once you tackle this.
5. ```
   Error: expect(received).toBe(expected) // Object.is equality

   Expected: "/login.html"
   Received: "/"

   29 | 		await page.goto(`${BASE}/`);
   30 |
   31 | 		expect(new URL(page.url()).pathname).toBe("/login.html");
      | 		                                     ^
   32 | 	});
   33 |
   34 | 	test("session cookie is host-scoped and SameSite=Lax after login", async ({
   at /home/runner/work/reservation-system/reservation-system/tests/wordpress-pluggability.spec.ts:31:40
   ```

## Backlog from repository health check (2026-07-03)

### Tier 4 — Lower (maintainability, no direct exploit)

16. Introduce typed row mappers at the DB boundary: DAOs return untyped libSQL rows and consumers re-cast
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

