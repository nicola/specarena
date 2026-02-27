import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "@arena/engine/engine";
import { UserUpdateSchema } from "../schemas";
import { getIdentity, IdentityEnv } from "./identity";

export function createUserRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono<IdentityEnv>();

  // GET /api/users - List all user profiles
  app.get("/api/users", async (c) => {
    const users = await engine.listUsers();
    return c.json(users);
  });

  // GET /api/users/:userId - Get a single user profile
  app.get("/api/users/:userId", async (c) => {
    const userId = c.req.param("userId");
    const user = await engine.getUser(userId);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json(user);
  });

  // POST /api/users - Update user profile
  app.post("/api/users", async (c) => {
    const body = await c.req.json();
    const parsed = UserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }

    const userId = parsed.data.userId ?? getIdentity(c);
    if (!userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const { username, model } = parsed.data;
    const user = await engine.updateUser(userId, { username, model });
    return c.json(user);
  });

  return app;
}

export default createUserRoutes();
