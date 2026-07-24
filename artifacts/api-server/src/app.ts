import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Reflecting any Origin (origin: true) while allowing credentials lets any
// external site make authenticated cross-site requests and read the
// responses -- so the allowed origins are pinned to our own frontends
// instead. FRONTEND_URL is already used elsewhere (mailer.ts, auth.ts) for
// the same production frontend; Vercel preview deployments and localhost
// dev servers are allowed via pattern since their exact URL isn't fixed.
const ALLOWED_ORIGINS = [process.env["FRONTEND_URL"], "https://thinknbuild.in", "https://www.thinknbuild.in"].filter(
  (v): v is string => !!v,
);
const ALLOWED_ORIGIN_PATTERNS = [/^https:\/\/[a-z0-9-]+\.vercel\.app$/, /^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin))) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  }),
);
app.use(
  express.json({
    // Stash the raw request body alongside the parsed one -- the Razorpay
    // webhook handler needs the exact raw bytes to verify the signature.
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", router);

export default app;
