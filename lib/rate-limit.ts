import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
    throw new Error("Upstash Redis Umgebungsvariablen fehlen.");
}

const redis = new Redis({
    url: redisUrl,
    token: redisToken,
});

export const chatRateLimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "kajabi-chatbot",
});