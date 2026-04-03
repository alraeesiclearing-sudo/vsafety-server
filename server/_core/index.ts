import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initSocket } from "../socket";
import { createSiteApiRouter } from "../site-api";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // تهيئة Socket.io
  initSocket(server);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ==================== Site API (للموقع الأمامي الأصلي) ====================
  // يستقبل طلبات POST على /data/?typeReq=... من الموقع الأمامي
  app.use("/data", createSiteApiRouter());
  // أيضاً على /site/data/ و /booking/data/ وأي مسار فرعي
  app.use("*/data", createSiteApiRouter());

  // ==================== خدمة الموقع الأمامي الأصلي ====================
  // الموقع الأصلي (dist) متاح على /site/
  const clientSitePath = process.env.NODE_ENV === "development"
    ? path.resolve(import.meta.dirname, "../../client-site")
    : path.resolve(import.meta.dirname, "../client-site");

  if (fs.existsSync(clientSitePath)) {
    // خدمة الملفات الثابتة (CSS, JS, images) من /assets/ مباشرة
    app.use("/assets", express.static(path.join(clientSitePath, "assets")));
    // الموقع الأمامي على /site/ وجميع صفحاته
    app.use("/site", express.static(clientSitePath));
    app.use("/booking", express.static(clientSitePath));
    app.use("/payment", express.static(clientSitePath));
    app.use("/nafath", express.static(clientSitePath));
    app.use("/motasel", express.static(clientSitePath));
    app.use("/confirm", express.static(clientSitePath));
    // Fallback: أي مسار غير معروف يُعيد index.html للموقع الأمامي
    const clientSitePages = ["/booking", "/payment", "/nafath", "/motasel", "/confirm"];
    clientSitePages.forEach(p => {
      app.get(`${p}/*`, (_req, res) => {
        res.sendFile(path.join(clientSitePath, "index.html"));
      });
    });
    console.log(`[Server] Serving client-site from: ${clientSitePath}`);
  } else {
    console.warn(`[Server] client-site not found at: ${clientSitePath}`);
  }

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
