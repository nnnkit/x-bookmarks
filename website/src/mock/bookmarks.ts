import type { Bookmark } from "@ext/types";

function avatar(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

function hoursAgo(hours: number): number {
  return Date.now() - hours * 60 * 60 * 1000;
}

function daysAgo(days: number): number {
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

let sortCounter = 1900000000000000000n;
function nextSortIndex(): string {
  sortCounter -= 1000000000000n;
  return String(sortCounter);
}

function makeBookmark(
  partial: Partial<Bookmark> &
    Pick<Bookmark, "tweetId" | "text" | "author">,
): Bookmark {
  const sortIndex = partial.sortIndex || nextSortIndex();
  return {
    id: partial.tweetId,
    tweetId: partial.tweetId,
    text: partial.text,
    createdAt: partial.createdAt || hoursAgo(2),
    sortIndex,
    author: partial.author,
    metrics: partial.metrics || {
      likes: 0,
      retweets: 0,
      replies: 0,
      views: 0,
      bookmarks: 0,
    },
    media: partial.media || [],
    urls: partial.urls || [],
    isThread: partial.isThread || false,
    hasImage: partial.hasImage || false,
    hasVideo: partial.hasVideo || false,
    hasLink: partial.hasLink || false,
    isLongText: partial.isLongText || false,
    quotedTweet: partial.quotedTweet || null,
    retweetedTweet: partial.retweetedTweet || null,
    article: partial.article || null,
    tweetKind: partial.tweetKind || "tweet",
    inReplyToTweetId: partial.inReplyToTweetId,
    inReplyToScreenName: partial.inReplyToScreenName,
  };
}

export const MOCK_BOOKMARKS: Bookmark[] = [
  // 1. AI insight — short tweet
  makeBookmark({
    tweetId: "1001",
    text: "The most interesting thing about AI right now isn't the models — it's what happens when you give everyone access to a really good reasoning engine. We're about to see a Cambrian explosion of problem-solving.",
    createdAt: hoursAgo(1),
    author: {
      name: "Sam Altman",
      screenName: "sama",
      profileImageUrl: avatar("sama"),
      verified: true,
    },
    metrics: {
      likes: 42800,
      retweets: 5200,
      replies: 1800,
      views: 3200000,
      bookmarks: 12400,
    },
  }),

  // 2. Thread about building products
  makeBookmark({
    tweetId: "1002",
    text: "I've been building products for 20 years. Here's what I wish someone told me on day one:\n\n1. Users don't care about your architecture. They care about their problem getting solved.\n\n2. Ship early, but not broken. There's a difference between MVP and embarrassing.\n\n3. The best feature is the one that removes a step from the workflow.\n\n4. Your most loyal users are the ones who complained and stayed.\n\n5. Data tells you what happened. Talking to users tells you why.",
    createdAt: hoursAgo(3),
    author: {
      name: "Paul Graham",
      screenName: "paulg",
      profileImageUrl: avatar("paulg"),
      verified: true,
    },
    metrics: {
      likes: 28500,
      retweets: 8100,
      replies: 920,
      views: 1800000,
      bookmarks: 9200,
    },
    isThread: true,
    isLongText: true,
    tweetKind: "thread",
  }),

  // 3. Article about programming
  makeBookmark({
    tweetId: "1003",
    text: "I wrote about why I think simplicity in software design is not about writing less code — it's about making the right abstractions at the right time.",
    createdAt: hoursAgo(6),
    author: {
      name: "Salvatore Sanfilippo",
      screenName: "antirez",
      profileImageUrl: avatar("antirez"),
      verified: true,
    },
    metrics: {
      likes: 15200,
      retweets: 3400,
      replies: 580,
      views: 920000,
      bookmarks: 6800,
    },
    hasLink: true,
    tweetKind: "article",
    article: {
      title: "The Art of Simplicity in Software Design",
      plainText:
        "Software simplicity is often misunderstood. Many developers equate simplicity with brevity — writing fewer lines of code. But true simplicity in software design is about clarity of intent and appropriateness of abstraction.\n\nWhen I designed Redis, every decision was guided by a single question: does this make the common case simpler? Not the general case. Not the edge case. The common case.\n\nThis principle led to some controversial choices. Redis is single-threaded. Its data structures are intentionally limited. Its protocol is human-readable. Each of these choices made certain things harder, but they made the things people actually do much, much easier.\n\nThe key insight is that abstraction has a cost. Every layer of indirection you add is a layer that someone must understand. The best abstractions are the ones that make you forget they exist.\n\nHere are my rules for simplicity:\n\n1. If you can remove it without anyone noticing, remove it.\n2. If adding it requires a paragraph of explanation, reconsider.\n3. If it solves a problem no one has yet, wait.\n4. If the common case needs special handling, your abstraction is wrong.\n\nSimplicity is not the starting point of design. It's the end point. You arrive at simplicity by understanding the problem deeply enough to see what doesn't need to be there.",
      coverImageUrl:
        "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80",
    },
    urls: [
      {
        url: "https://t.co/abc123",
        displayUrl: "antirez.com/news/...",
        expandedUrl: "http://antirez.com/news/simplicity",
      },
    ],
  }),

  // 4. Photo tweet
  makeBookmark({
    tweetId: "1004",
    text: "Northern lights over Tromsø, Norway. Sometimes nature reminds you that the real resolution is infinite.",
    createdAt: hoursAgo(12),
    author: {
      name: "National Geographic",
      screenName: "NatGeo",
      profileImageUrl: avatar("NatGeo"),
      verified: true,
    },
    metrics: {
      likes: 89200,
      retweets: 14500,
      replies: 2100,
      views: 8500000,
      bookmarks: 32100,
    },
    media: [
      {
        type: "photo",
        url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200&q=80",
        width: 1200,
        height: 800,
        altText:
          "Northern lights over snowy mountains in Tromsø, Norway",
      },
    ],
    hasImage: true,
  }),

  // 5. Quoted tweet
  makeBookmark({
    tweetId: "1005",
    text: "This is correct. The highest leverage activity for any knowledge worker is reading. Not just articles — source material, academic papers, primary documents. Most people read summaries of summaries.",
    createdAt: hoursAgo(18),
    author: {
      name: "Naval",
      screenName: "naval",
      profileImageUrl: avatar("naval"),
      verified: true,
    },
    metrics: {
      likes: 34200,
      retweets: 6800,
      replies: 1200,
      views: 2400000,
      bookmarks: 15200,
    },
    quotedTweet: {
      tweetId: "900",
      text: "The average CEO reads 60 books a year. The average person reads 4. What you consume shapes what you create.",
      createdAt: hoursAgo(24),
      author: {
        name: "Ryan Holiday",
        screenName: "RyanHoliday",
        profileImageUrl: avatar("RyanHoliday"),
        verified: true,
      },
      media: [],
    },
    tweetKind: "quote",
  }),

  // 6. Long technical post
  makeBookmark({
    tweetId: "1006",
    text: "A practical guide to building with LLMs in production:\n\nAfter deploying LLM-powered features to millions of users, here's what I've learned about making these systems reliable.\n\nFirst, the mental model: treat the LLM as a fuzzy function. It takes structured input and produces structured output, but with some probability of being wrong. Your job is to build the scaffolding that makes this acceptable.\n\nKey patterns that work:\n\n1. Constrained generation: Don't let the model free-write. Give it templates and force it into structured outputs (JSON, enums, etc). This alone eliminates 60% of production issues.\n\n2. Retrieval over memorization: The model's parametric knowledge is stale and sometimes wrong. Always retrieve relevant context from your own data sources.\n\n3. Multi-step verification: For anything important, use a second, cheaper model to verify the first model's output. Think of it as an automated code review.\n\n4. Graceful degradation: Always have a fallback. If the LLM fails, what does the user see? This should never be an error page.\n\n5. Evaluation before deployment: Build an eval set from real user queries. Run it on every model change. This is your test suite.\n\nThe most common mistake I see: treating LLMs as a database. They're not. They're a reasoning engine. Feed them context, ask them to reason, verify the output.",
    createdAt: daysAgo(1),
    author: {
      name: "Andrej Karpathy",
      screenName: "karpathy",
      profileImageUrl: avatar("karpathy"),
      verified: true,
    },
    metrics: {
      likes: 52100,
      retweets: 12800,
      replies: 3200,
      views: 4800000,
      bookmarks: 22400,
    },
    isLongText: true,
  }),

  // 7. Link sharing
  makeBookmark({
    tweetId: "1007",
    text: "We just shipped a complete rewrite of our image optimization pipeline. 3x faster cold starts, 50% less memory. Here's the technical deep-dive.",
    createdAt: daysAgo(1),
    author: {
      name: "Guillermo Rauch",
      screenName: "rauchg",
      profileImageUrl: avatar("rauchg"),
      verified: true,
    },
    metrics: {
      likes: 8900,
      retweets: 2100,
      replies: 340,
      views: 620000,
      bookmarks: 3800,
    },
    hasLink: true,
    urls: [
      {
        url: "https://t.co/xyz789",
        displayUrl: "vercel.com/blog/...",
        expandedUrl:
          "https://vercel.com/blog/image-optimization-rewrite",
      },
    ],
  }),

  // 8. Indie hacker building in public
  makeBookmark({
    tweetId: "1008",
    text: "Month 6 update on my solo SaaS:\n\nMRR: $4,200 → $8,700\nCustomers: 89 → 156\nChurn: 4.2% → 2.8%\nSupport tickets: down 40% (better onboarding)\n\nBiggest lesson: I spent 3 months building features nobody asked for. Then I spent 1 month fixing the signup flow and revenue doubled.\n\nThe boring stuff is the growth stuff.",
    createdAt: daysAgo(2),
    author: {
      name: "Sarah Chen",
      screenName: "sarahbuilds",
      profileImageUrl: avatar("sarahbuilds"),
      verified: false,
    },
    metrics: {
      likes: 6200,
      retweets: 890,
      replies: 280,
      views: 340000,
      bookmarks: 2400,
    },
    isLongText: true,
  }),

  // 9. Design wisdom
  makeBookmark({
    tweetId: "1009",
    text: "Good design is obvious. Great design is transparent.\n\nThe best interfaces don't make you think about the interface. They make you think about your work.",
    createdAt: daysAgo(2),
    author: {
      name: "John Maeda",
      screenName: "johnmaeda",
      profileImageUrl: avatar("johnmaeda"),
      verified: true,
    },
    metrics: {
      likes: 18400,
      retweets: 3200,
      replies: 420,
      views: 1100000,
      bookmarks: 7200,
    },
  }),

  // 10. Engineering thread
  makeBookmark({
    tweetId: "1010",
    text: "Why we migrated from microservices back to a monolith — and why it was the best engineering decision we made this year.\n\nOur system had 23 microservices. Each one had its own database, its own deployment pipeline, its own monitoring dashboards. We had 4 engineers.\n\nThe overhead was killing us. We spent more time debugging inter-service communication than building features. A simple database query that used to take 2ms was now a chain of 4 API calls taking 200ms.\n\nThe migration took 6 weeks. Here's what changed:\n\nDeploy time: 45 min → 3 min\nP99 latency: 1.2s → 180ms\nOn-call incidents: 12/month → 2/month\nTime to ship new feature: ~2 weeks → ~2 days\n\nMicroservices are a scaling strategy, not an architecture strategy. If your team is small, a well-structured monolith will outperform microservices every time.",
    createdAt: daysAgo(3),
    author: {
      name: "Kelsey Hightower",
      screenName: "kelseyhightower",
      profileImageUrl: avatar("kelseyhightower"),
      verified: true,
    },
    metrics: {
      likes: 31200,
      retweets: 7800,
      replies: 1600,
      views: 2200000,
      bookmarks: 11800,
    },
    isThread: true,
    isLongText: true,
    tweetKind: "thread",
  }),

  // 11. Product insight
  makeBookmark({
    tweetId: "1011",
    text: "Hot take: the best product managers are the ones who say no the most.\n\nEvery feature you add is a feature you have to maintain, document, support, and explain. The product isn't the features — it's the experience between them.",
    createdAt: daysAgo(3),
    author: {
      name: "Shreyas Doshi",
      screenName: "shreyas",
      profileImageUrl: avatar("shreyas"),
      verified: true,
    },
    metrics: {
      likes: 14800,
      retweets: 2400,
      replies: 680,
      views: 820000,
      bookmarks: 5400,
    },
  }),

  // 12. Photo with technical content
  makeBookmark({
    tweetId: "1012",
    text: "Visualizing how attention works in transformers. Each layer learns different patterns — early layers capture syntax, middle layers capture semantics, and late layers specialize for the task.",
    createdAt: daysAgo(4),
    author: {
      name: "Lilian Weng",
      screenName: "lilianweng",
      profileImageUrl: avatar("lilianweng"),
      verified: true,
    },
    metrics: {
      likes: 22100,
      retweets: 4600,
      replies: 890,
      views: 1500000,
      bookmarks: 9800,
    },
    media: [
      {
        type: "photo",
        url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&q=80",
        width: 1200,
        height: 675,
        altText:
          "Visualization of attention patterns in neural networks",
      },
    ],
    hasImage: true,
  }),

  // 13. Book recommendation
  makeBookmark({
    tweetId: "1013",
    text: 'If you read one book this year, make it "The Beginning of Infinity" by David Deutsch.\n\nIt fundamentally changed how I think about progress, knowledge, and why optimism is the only rational worldview. Not self-help optimism — epistemological optimism. Problems are soluble.',
    createdAt: daysAgo(5),
    author: {
      name: "Patrick Collison",
      screenName: "patrickc",
      profileImageUrl: avatar("patrickc"),
      verified: true,
    },
    metrics: {
      likes: 19200,
      retweets: 3100,
      replies: 540,
      views: 1200000,
      bookmarks: 8600,
    },
    hasLink: true,
    urls: [
      {
        url: "https://t.co/book123",
        displayUrl: "amazon.com/...",
        expandedUrl:
          "https://www.amazon.com/Beginning-Infinity-David-Deutsch/dp/0143121359",
      },
    ],
  }),

  // 14. Video tweet
  makeBookmark({
    tweetId: "1014",
    text: "Just finished a 2-minute demo of our new real-time collaboration engine. Multiple cursors, conflict-free editing, and it works offline. Built on CRDTs.",
    createdAt: daysAgo(5),
    author: {
      name: "Martin Kleppmann",
      screenName: "martinkl",
      profileImageUrl: avatar("martinkl"),
      verified: true,
    },
    metrics: {
      likes: 11800,
      retweets: 2800,
      replies: 420,
      views: 780000,
      bookmarks: 4600,
    },
    media: [
      {
        type: "video",
        url: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&q=80",
        width: 1920,
        height: 1080,
        altText: "Demo of real-time collaboration engine",
      },
    ],
    hasVideo: true,
  }),

  // 15. Wisdom tweet
  makeBookmark({
    tweetId: "1015",
    text: 'The gap between "I know how to do this" and "I do this consistently" is where most of life\'s value is lost.\n\nKnowledge without execution is just trivia.',
    createdAt: daysAgo(6),
    author: {
      name: "James Clear",
      screenName: "JamesClear",
      profileImageUrl: avatar("JamesClear"),
      verified: true,
    },
    metrics: {
      likes: 45600,
      retweets: 9800,
      replies: 1400,
      views: 5200000,
      bookmarks: 18200,
    },
  }),
];
