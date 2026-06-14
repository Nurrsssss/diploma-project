package database

import (
	"context"
	"embed"
	"fmt"
	"log"
	"time"

	"github.com/beereket/vitalem-api-client/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed create_analysis_records.sql init_survey_questions.sql add_preliminary_conclusion_file_id.sql create_health_passports.sql
var embeddedMigrations embed.FS

var DB *pgxpool.Pool

func InitDB(cfg *config.Config) error {
	dsn := fmt.Sprintf("postgresql://%s:%s@%s:%s/%s",
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.DBName,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("failed to connect to DB: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping failed: %w", err)
	}

	DB = pool
	return nil
}

func RunMigrations() error {
	ctx := context.Background()
	log.Print("database: applying embedded SQL migrations (not read from disk)")

	migrationFiles := []string{
		"create_analysis_records.sql",
		"init_survey_questions.sql",
		"add_preliminary_conclusion_file_id.sql",
		"create_health_passports.sql",
	}

	for _, filename := range migrationFiles {
		content, err := embeddedMigrations.ReadFile(filename)
		if err != nil {
			return fmt.Errorf("read embedded migration %s: %w", filename, err)
		}

		_, err = DB.Exec(ctx, string(content))
		if err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", filename, err)
		}
		log.Printf("migration ok: %s", filename)
	}

	return nil
}
