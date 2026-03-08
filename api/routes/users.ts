import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "@arena/engine/engine";
import { UserUpdateSchema } from "../schemas";
import { getIdentity, IdentityEnv } from "./identity";
import { collectUserProfiles } from "./challenges";

export function createUserRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono<IdentityEnv>();

  // GET /api/users - List all user profiles
  app.get("/api/users", async (c) => {
    const users = await engine.users.listUsers();
    return c.json(users);
  });

  // GET /api/users/batch?ids=id1,id2,id3 - Get multiple user profiles
  app.get("/api/users/batch", async (c) => {
    const idsParam = c.req.query("ids");
    if (!idsParam) {
      return c.json({ error: "ids query parameter is required" }, 400);
    }
    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0) {
      return c.json({});
    }
    const profiles = await engine.users.getUsers(ids);
    return c.json(profiles);
  });

  // GET /api/users/:userId/scores - Get scoring data for a user
  // (must be registered before the :userId catch-all below)
  app.get("/api/users/:userId/scores", async (c) => {
    if (!engine.scoring) {
      return c.json({ error: "Scoring not configured" }, 404);
    }
    const userId = c.req.param("userId");
    const scores = await engine.scoring.getScoringForPlayer(userId);
    return c.json(scores);
  });

  // GET /api/users/:userId/challenges - Get all challenges for a user
  // (must be registered before the :userId catch-all below)
  app.get("/api/users/:userId/challenges", async (c) => {
    const userId = c.req.param("userId");
    const limit = Math.max(1, parseInt(c.req.query("limit") || "50", 10) || 50);
    const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0);
    const { items: all } = await engine.getChallengesByUserId(userId);
    const challenges = all.filter((c) => c.state?.gameEnded);
    const total = challenges.length;
    const sliced = challenges.slice(offset, offset + limit);
    const profiles = await collectUserProfiles(engine, sliced);
    return c.json({ challenges: sliced, total, limit, offset, profiles });
  });

  // GET /api/users/:userId - Get a single user profile
  app.get("/api/users/:userId", async (c) => {
    const userId = c.req.param("userId");
    const user = await engine.users.getUser(userId);
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

    const { username, model, isBenchmark } = parsed.data;
    const user = await engine.users.setUser(userId, { username, model, isBenchmark });
    return c.json(user);
  });

  return app;
}

export default createUserRoutes();
