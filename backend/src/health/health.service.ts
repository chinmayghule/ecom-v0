import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async check() {
    let dbStatus = "ok";
    let lastMigration: string | null = null;
    try {
      await Promise.race([
        this.dataSource.query("SELECT 1"),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("DB health check timed out")),
            5000,
          ),
        ),
      ]);
      const migrations = await this.dataSource.query(
        "SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1",
      );
      lastMigration = migrations[0]?.name ?? null;
    } catch (err) {
      dbStatus = "error";
      this.logger.error(
        `Health check failed: ${err instanceof Error ? err.message : err}`,
      );
    }

    return {
      status: dbStatus === "ok" ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        rss: process.memoryUsage().rss,
      },
      database: dbStatus,
      lastMigration,
    };
  }
}
