#!/usr/bin/env node
import { program } from "@commander-js/extra-typings";
import { serve } from "@hono/node-server";
import app from "./app";

program
    .option("-p, --port <port>", "port to listen on", Number.parseFloat, 3000)
    .action(({ port }) => {
        const hostname = "0.0.0.0";
        const server = serve({
            fetch: app.fetch,
            hostname,
            port,
        });
        server.on("listening", () => {
            console.log(`passkey-server running on ${hostname}:${port}`);
        });

        // graceful shutdown
        process.on("SIGINT", () => {
            server.close();
            process.exit(0);
        });
        process.on("SIGTERM", () => {
            server.close((err) => {
                if (err) {
                    console.error(err);
                    process.exit(1);
                }
                process.exit(0);
            });
        });
    });

program.parse();
