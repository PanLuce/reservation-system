import { test } from "@playwright/experimental-ct-react";
import { Jakub } from "./dsl/Jakub";
import { Petra } from "./dsl/Petra";
import { Sites } from "./dsl/Sites";
import { TestContext } from "./dsl/TestContext";

test.describe("ScreenExplorer", () => {
	let context: TestContext;
	let sites: Sites;

	test.beforeEach(async ({ page, mount }) => {
		context = new TestContext(page, mount);
		sites = new Sites(context);
		page.on("console", (msg) => console.log("BROWSER:", msg.text()));
	});

	test.describe("Given Petra persona", () => {
		let petra: Petra;

		test.beforeEach(async () => {
			petra = new Petra(context);
			await petra.opensAMap();
		});

		test.describe("Given a site exists at Alexanderplatz U-Bahn entrance and Alexanderplatz TV Tower side", () => {
			test.beforeEach(async () => {
				await sites.existAt(["Alexanderplatz U-Bahn entrance, Berlin"]);
			});

			test.describe("When Petra looks at a map of Berlin showing Alexanderplatz", () => {
				test.beforeEach(async () => {
					await petra.looksAt("Alexanderplatz, Berlin");
				});

				test("Then Petra sees the screen at U-Bahn entrance", async () => {
					await petra.seesScreen("Alexanderplatz U-Bahn entrance, Berlin");
				});
			});
		});

		test.describe("Given a screen exists at Marienplatz", () => {
			test.beforeEach(async () => {
				await sites.existAt(["Marienplatz, Munich"]);
			});

			test.describe("When Petra looks at a map showing only Alexanderplatz", () => {
				test.beforeEach(async () => {
					await petra.looksAt("Alexanderplatz, Berlin");
				});

				test("Then Petra does not see the Marienplatz screen", async () => {
					await petra.doesNotSeeScreen("Marienplatz, Munich");
				});
			});
		});

		test.describe("Given a screen exists at Marienplatz Munich, and Petra looks at Alexanderplatz Berlin", () => {
			test.beforeEach(async () => {
				await sites.existAt(["Marienplatz, Munich"]);
				await petra.looksAt("Alexanderplatz, Berlin");
			});

			test.describe("When Petra looks away from Alexanderplatz to Marienplatz", () => {
				test.beforeEach(async () => {
					await petra.looksAt("Marienplatz, Munich");
				});

				test("Then Petra sees the Marienplatz screen", async () => {
					await petra.seesScreen("Marienplatz, Munich");
				});
			});
		});
	});

	test.describe("Given Jakub persona", () => {
		let jakub: Jakub;

		test.beforeEach(async () => {
			jakub = new Jakub(context);
			await jakub.opensAMap();
		});

		test.describe("Given a screen exists at Berlin Alexanderplatz, Hamburg Hauptbahnhof and Munich Marienplatz", () => {
			test.beforeEach(async () => {
				await sites.existAt([
					"Berlin Alexanderplatz",
					"Hamburg Hauptbahnhof",
					"Munich Marienplatz",
				]);
			});

			test.describe("When Jakub looks at a map of all Germany", () => {
				test.beforeEach(async () => {
					await jakub.looksAt("Germany");
				});

				test("Then Jakub sees screens in Berlin, Hamburg and Munich", async () => {
					await jakub.seesScreens([
						"Berlin Alexanderplatz",
						"Hamburg Hauptbahnhof",
						"Munich Marienplatz",
					]);
				});
			});
		});

		test.describe("Given 2 sites exist in Berlin and 3 sites exist in Munich", () => {
			test.beforeEach(async () => {
				await sites.existAt([
					"Berlin Alexanderplatz",
					"Berlin Hauptbahnhof",
					"Munich Marienplatz",
					"Munich Stachus",
					"Munich Ostbahnhof",
				]);
			});

			test.describe("When Jakub looks at whole Germany on the map", () => {
				test.beforeEach(async () => {
					await jakub.looksAt("Germany");
				});

				test("Then he sees all 5 sites listed in the map's site list", async () => {
					await jakub.seesListedSites([
						"Berlin Alexanderplatz",
						"Berlin Hauptbahnhof",
						"Munich Marienplatz",
						"Munich Stachus",
						"Munich Ostbahnhof",
					]);
				});
			});

			test.describe("When Jakub looks at Berlin only", () => {
				test.beforeEach(async () => {
					await jakub.looksAt("Berlin");
				});

				test("Then he sees only 2 Berlin sites listed in the map's site list", async () => {
					await jakub.seesListedSites([
						"Berlin Alexanderplatz",
						"Berlin Hauptbahnhof",
					]);
				});
			});

			test.describe("When Jakub looks at Munich only", () => {
				test.beforeEach(async () => {
					await jakub.looksAt("Munich");
				});

				test("Then he sees only 3 Munich sites listed in the map's site list", async () => {
					await jakub.seesListedSites([
						"Munich Marienplatz",
						"Munich Stachus",
						"Munich Ostbahnhof",
					]);
				});
			});
		});
	});
});
