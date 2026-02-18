import { Hono } from "hono";
import { challenges, createChallenge, getChallengesByType, getAllChallengeMetadata, getChallengeMetadata } from "../storage/challenges";

const app = new Hono();

// GET /api/metadata - all challenge metadata
app.get("/api/metadata", (c) => {
  return c.json(getAllChallengeMetadata());
});

// GET /api/metadata/:name - single challenge metadata
app.get("/api/metadata/:name", (c) => {
  const name = c.req.param("name");
  const metadata = getChallengeMetadata(name);
  if (!metadata) {
    return c.json({ error: "Challenge not found" }, 404);
  }
  return c.json(metadata);
});

// GET /api/challenges - list all challenges
app.get("/api/challenges", (c) => {
  const challengesList = Array.from(challenges.values());
  return c.json({ challenges: challengesList, count: challengesList.length });
});

// GET /api/challenges/:name - list by type
app.get("/api/challenges/:name", (c) => {
  const name = c.req.param("name");
  try {
    const challengesList = getChallengesByType(name);
    return c.json({ challenges: challengesList, count: challengesList.length });
  } catch (error) {
    console.error("Error fetching challenges:", error);
    return c.json({ error: "Failed to fetch challenges" }, 500);
  }
});

// POST /api/challenges/:name - create challenge
app.post("/api/challenges/:name", (c) => {
  const name = c.req.param("name");
  try {
    const challenge = createChallenge(name);
    return c.json(challenge);
  } catch (error) {
    console.error("Error creating challenge:", error);
    return c.json({ error: "Failed to create challenge" }, 500);
  }
});

export default app;
