import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import { getTokenFromHeader, handleOptions, setCorsHeaders } from "./_helpers.js";
import { prisma } from "./_prisma.js";
import { getUsageAnalytics } from "../lib/ai-usage.js";

export default async function adminAiUsageHandler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method === "OPTIONS") {
    handleOptions(req, res);
    return;
  }

  setCorsHeaders(res);

  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string;
      };
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!admin || admin.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const hours = parseInt(String(req.query.hours || "24"), 10) || 24;
    const bucketMinutes =
      parseInt(String(req.query.bucketMinutes || "15"), 10) || 15;

    const analytics = await getUsageAnalytics(hours, bucketMinutes);

    return res.status(200).json(analytics);
  } catch (error: unknown) {
    console.error("[admin-ai-usage]", error);
    return res.status(500).json({ error: "Failed to load AI usage analytics" });
  }
}
