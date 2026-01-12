import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { AuthService } from "../src/auth.js";
import {
	db,
	initializeDatabase,
	ParticipantDB,
	UserDB,
} from "../src/database.js";

test.describe.configure({ mode: "serial" });

test.describe("Authentication Service", () => {
	// Initialize and clean up database before each test
	test.beforeEach(() => {
		// Initialize database schema
		initializeDatabase();
		// Clear tables for clean test state
		db.exec("DELETE FROM users");
		db.exec("DELETE FROM participants");
	});

	test.describe("login", () => {
		test("should login successfully with valid credentials", async () => {
			// Arrange
			const authService = new AuthService();
			const email = "test@example.com";
			const password = "password123";
			const passwordHash = await bcrypt.hash(password, 10);

			UserDB.insert({
				id: "user_1",
				email,
				passwordHash,
				name: "Test User",
				role: "participant",
			});

			// Act
			const result = await authService.login(email, password);

			// Assert
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.user.email).toBe(email);
				expect(result.user.name).toBe("Test User");
				expect(result.user.role).toBe("participant");
			}
		});

		test("should fail login with invalid email", async () => {
			// Arrange
			const authService = new AuthService();
			const email = "nonexistent@example.com";
			const password = "password123";

			// Act
			const result = await authService.login(email, password);

			// Assert
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe("Invalid email or password");
			}
		});

		test("should fail login with invalid password", async () => {
			// Arrange
			const authService = new AuthService();
			const email = "invalidpw@example.com"; // unique email
			const correctPassword = "password123";
			const wrongPassword = "wrongpassword";
			const passwordHash = await bcrypt.hash(correctPassword, 10);

			UserDB.insert({
				id: "user_invalid_pw",
				email,
				passwordHash,
				name: "Test User",
				role: "participant",
			});

			// Act
			const result = await authService.login(email, wrongPassword);

			// Assert
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe("Invalid email or password");
			}
		});

		test("should update last login timestamp on successful login", async () => {
			// Arrange
			const authService = new AuthService();
			const email = "lastlogin@example.com"; // unique email
			const password = "password123";
			const passwordHash = await bcrypt.hash(password, 10);

			UserDB.insert({
				id: "user_lastlogin",
				email,
				passwordHash,
				name: "Test User",
				role: "participant",
			});

			// Act
			const loginResult = await authService.login(email, password);

			// Assert
			expect(loginResult.success).toBe(true);
			const user = UserDB.getById("user_lastlogin") as Record<string, unknown>;
			expect(user).toBeDefined();
			expect(user.lastLogin).toBeDefined();
			expect(user.lastLogin).not.toBeNull();
		});

		test("should login admin user successfully", async () => {
			// Arrange
			const authService = new AuthService();
			const email = "admin@example.com";
			const password = "admin123";
			const passwordHash = await bcrypt.hash(password, 10);

			UserDB.insert({
				id: "admin_1",
				email,
				passwordHash,
				name: "Admin User",
				role: "admin",
			});

			// Act
			const result = await authService.login(email, password);

			// Assert
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.user.role).toBe("admin");
			}
		});
	});

	test.describe("register", () => {
		test("should register a new participant successfully", async () => {
			// Arrange
			const authService = new AuthService();
			const email = "newuser@example.com";
			const password = "password123";
			const name = "New User";

			// Act
			const result = await authService.register(email, password, name);

			// Assert
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.user.email).toBe(email);
				expect(result.user.name).toBe(name);
				expect(result.user.role).toBe("participant");
				expect(result.user.id).toBeDefined();
			}
		});

		test("should register a new admin successfully", async () => {
			// Arrange
			const authService = new AuthService();
			const email = "newadmin@example.com";
			const password = "admin123";
			const name = "New Admin";
			const role = "admin" as const;

			// Act
			const result = await authService.register(email, password, name, role);

			// Assert
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.user.role).toBe("admin");
			}
		});

		test("should fail registration if email already exists", async () => {
			// Arrange
			const authService = new AuthService();
			const email = "existing@example.com";
			const password = "password123";
			const passwordHash = await bcrypt.hash(password, 10);

			UserDB.insert({
				id: "user_1",
				email,
				passwordHash,
				name: "Existing User",
				role: "participant",
			});

			// Act
			const result = await authService.register(
				email,
				"newpassword",
				"New User",
			);

			// Assert
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe("User already exists");
			}
		});

		test("should hash password when registering", async () => {
			// Arrange
			const authService = new AuthService();
			const email = "newuser@example.com";
			const password = "password123";
			const name = "New User";

			// Act
			const result = await authService.register(email, password, name);

			// Assert
			if (result.success) {
				const user = UserDB.getByEmail(email) as Record<string, unknown>;
				expect(user.passwordHash).toBeDefined();
				expect(user.passwordHash).not.toBe(password); // Password should be hashed
				// Verify the hash can be compared
				const match = await bcrypt.compare(
					password,
					user.passwordHash as string,
				);
				expect(match).toBe(true);
			}
		});

		test("should register participant with participantId", async () => {
			// Arrange
			const authService = new AuthService();
			const email = "participant@example.com";
			const password = "password123";
			const name = "Participant User";
			const participantId = "p_withid_123"; // unique ID

			// Create participant record first (to satisfy FOREIGN KEY constraint)
			ParticipantDB.insert({
				id: participantId,
				name: "Child Name",
				email: email,
				phone: "+420 777 888 999",
				ageGroup: "3-12 months",
			});

			// Act
			const result = await authService.register(
				email,
				password,
				name,
				"participant",
				participantId,
			);

			// Assert
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.user.participantId).toBe(participantId);
			}
		});
	});

	test.describe("verifyToken", () => {
		test("should verify token and return user", () => {
			// Arrange
			const authService = new AuthService();
			const userId = "user_verify";
			const email = "verify@example.com"; // unique email
			const passwordHash = bcrypt.hashSync("password123", 10);

			UserDB.insert({
				id: userId,
				email,
				passwordHash,
				name: "Test User",
				role: "participant",
			});

			// Act
			const user = authService.verifyToken(userId);

			// Assert
			expect(user).toBeDefined();
			expect(user?.id).toBe(userId);
			expect(user?.email).toBe(email);
			expect(user?.name).toBe("Test User");
			expect(user?.role).toBe("participant");
		});

		test("should return null for non-existent user", () => {
			// Arrange
			const authService = new AuthService();
			const userId = "nonexistent_user";

			// Act
			const user = authService.verifyToken(userId);

			// Assert
			expect(user).toBeNull();
		});

		test("should not return passwordHash in user object", () => {
			// Arrange
			const authService = new AuthService();
			const userId = "user_nopwhash";
			const passwordHash = bcrypt.hashSync("password123", 10);

			UserDB.insert({
				id: userId,
				email: "nopwhash@example.com", // unique email
				passwordHash,
				name: "Test User",
				role: "participant",
			});

			// Act
			const user = authService.verifyToken(userId);

			// Assert
			expect(user).toBeDefined();
			// TypeScript type should prevent passwordHash from being in User type
			expect(
				(user as unknown as Record<string, unknown>).passwordHash,
			).toBeUndefined();
		});
	});
});
