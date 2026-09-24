export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Rajkamal Reader Scoring API",
    version: "1.0.0",
    description:
      "Official REST API documentation for the Rajkamal Reader Scoring platform. Provides endpoints for reader authentication, profile management, Speechmatics audio transcription, reading evaluation, quiz attempts, and system health checks.",
    contact: {
      name: "Rajkamal Prakashan",
      url: "https://rajkamalprakashan.com",
    },
  },
  servers: [
    {
      url: "/",
      description: "Current Server Base URL",
    },
  ],
  tags: [
    { name: "Audio & AI", description: "Audio upload and Speechmatics transcription engine" },
    { name: "Scoring & Attempts", description: "Reading passage evaluation and quiz scoring" },
    { name: "Profile", description: "Reader profile bootstrap, update, and account management" },
    { name: "Authentication", description: "Session teardown and logout" },
    { name: "System", description: "Operational health status checks" },
  ],
  paths: {
    "/api/transcribe": {
      post: {
        summary: "Transcribe Reading Recording",
        description: "Uploads an audio recording file (WebM, MP4, OGG, WAV up to 5MB) and transcribes it using Speechmatics ASR engine for Hindi. Returns the transcript and cryptographic proof.",
        tags: ["Audio & AI"],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["audio"],
                properties: {
                  audio: {
                    type: "string",
                    format: "binary",
                    description: "Audio file recording (webm, mp4, ogg, wav up to 5MB)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Speech transcribed successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    text: { type: "string", example: "यह एक हिंदी पाठ का वाचन है।" },
                    source: { type: "string", example: "speechmatics" },
                    proof: { type: "string", description: "Signed HMAC proof token" },
                  },
                },
              },
            },
          },
          "400": { description: "Missing or invalid audio recording" },
          "413": { description: "Audio file exceeds 5MB limit" },
          "415": { description: "Unsupported audio MIME type" },
          "422": { description: "No speech detected or recording under 1,000 bytes" },
          "429": { description: "Transcription rate limit exceeded" },
          "502": { description: "Speechmatics upstream API error" },
          "503": { description: "Transcription service non-configured" },
          "504": { description: "Transcription processing timed out" },
        },
      },
    },
    "/api/attempts/reading": {
      post: {
        summary: "Submit Verified Reading Score Attempt",
        description: "Verifies the audio transcription proof against reference text, computes reading accuracy, fluency, completion rate, and WPM, and saves the score.",
        tags: ["Scoring & Attempts"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["passageId", "durationSeconds", "proof"],
                properties: {
                  passageId: { type: "string", example: "sample-001" },
                  durationSeconds: { type: "integer", example: 42, minimum: 2, maximum: 1800 },
                  proof: { type: "string", description: "HMAC signed proof from /api/transcribe" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Reading score calculated and saved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    score: {
                      type: "object",
                      properties: {
                        accuracy: { type: "number", example: 94.5 },
                        fluency: { type: "number", example: 91.0 },
                        completion: { type: "number", example: 100.0 },
                        wordsPerMinute: { type: "number", example: 115 },
                        total: { type: "number", example: 93.8 },
                      },
                    },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid verified reading submission or proof payload" },
          "401": { description: "Reader session required" },
          "429": { description: "Attempt submission rate limit exceeded" },
          "500": { description: "Database insert error" },
        },
      },
    },
    "/api/attempts/quiz": {
      post: {
        summary: "Submit Literary Quiz Attempt",
        description: "Evaluates answers for the 8-question literary quiz and stores the score.",
        tags: ["Scoring & Attempts"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["answers"],
                properties: {
                  answers: {
                    type: "object",
                    description: "Key-value pair of question IDs to 0-indexed option choices",
                    example: {
                      q1: 2,
                      q2: 0,
                      q3: 1,
                      q4: 3,
                      q5: 0,
                      q6: 2,
                      q7: 1,
                      q8: 3,
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Quiz evaluated and score recorded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    correctCount: { type: "integer", example: 7 },
                    totalQuestions: { type: "integer", example: 8 },
                    totalScore: { type: "integer", example: 88 },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid quiz answers payload" },
          "401": { description: "Reader session required" },
          "429": { description: "Quiz submission rate limit exceeded" },
          "500": { description: "Database insert error" },
        },
      },
    },
    "/api/profile": {
      post: {
        summary: "Save or Update Reader Profile",
        description: "Updates details for the authenticated reader profile including personal details, location, leaderboard preference, and favorite literature.",
        tags: ["Profile"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", example: "प्रेमचंद पाठक", maxLength: 120 },
                  username: { type: "string", example: "premchand_reader", maxLength: 60 },
                  age: { type: "integer", example: 28, minimum: 5, maximum: 120 },
                  phone: { type: "string", example: "+919876543210" },
                  email: { type: "string", example: "reader@rajkamal.in" },
                  place: { type: "string", example: "वाराणसी" },
                  leaderboardOptIn: { type: "boolean", example: true },
                  favoriteAuthors: {
                    type: "array",
                    items: { type: "string" },
                    example: ["मुंशी प्रेमचंद", "मन्नू भंडारी"],
                  },
                  favoriteBooks: {
                    type: "array",
                    items: { type: "string" },
                    example: ["गोदान", "आपका बंटी"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Profile saved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean", example: true } },
                },
              },
            },
          },
          "400": { description: "Validation error in profile payload" },
          "401": { description: "Reader session required" },
          "429": { description: "Profile update rate limit exceeded" },
          "500": { description: "Database upsert error" },
        },
      },
    },
    "/api/profile/bootstrap": {
      post: {
        summary: "Bootstrap Reader Profile",
        description: "Initializes a minimal reader profile record in the database upon initial sign-in.",
        tags: ["Profile"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Profile bootstrapped successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                  },
                },
              },
            },
          },
          "401": { description: "Reader session missing or invalid" },
          "500": { description: "Database initialization error" },
          "503": { description: "Supabase service role key unconfigured" },
        },
      },
    },
    "/api/reader": {
      delete: {
        summary: "Delete Reader Account",
        description: "Permanently deletes the reader's user account and associated profile records.",
        tags: ["Profile"],
        security: [{ BearerAuth: [] }],
        responses: {
          "204": { description: "Account deleted successfully" },
          "401": { description: "Reader session required" },
          "500": { description: "Failed to delete reader account" },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        summary: "Logout Reader Session",
        description: "Signs out the current reader session, invalidates the access token, and resets authentication cookies.",
        tags: ["Authentication"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Logout successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    message: { type: "string", example: "Logged out successfully." },
                  },
                },
              },
            },
          },
          "429": { description: "Rate limit exceeded for logout requests" },
        },
      },
    },
    "/api/health": {
      get: {
        summary: "System Health Check",
        description: "Returns operational status of the service when authorized with the internal healthcheck token.",
        tags: ["System"],
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Service is healthy and operational",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                  },
                },
              },
            },
          },
          "404": { description: "Unauthorized or invalid health token provided" },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Supabase JWT Reader Session token provided in the Authorization header: `Bearer <token>`",
      },
    },
  },
};
