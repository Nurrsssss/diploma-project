package main

import (
	"fmt"
	"log"

	"github.com/beereket/vitalem-api-client/internal/database"

	"github.com/beereket/vitalem-api-client/internal/config"
	routes "github.com/beereket/vitalem-api-client/internal/router"

	_ "github.com/beereket/vitalem-api-client/docs"
)

func main() {
	cfg := config.Load()

	if err := database.InitDB(cfg); err != nil {
		log.Printf("database init failed: %v", err)
		return
	}
	if err := database.RunMigrations(); err != nil {
		log.Fatalf("database migrations failed: %v", err)
	}

	r := routes.SetupRouter(cfg)

	addr := fmt.Sprintf(":%s", cfg.Server.Port)
	if err := r.Run(addr); err != nil {
		log.Printf("server failed to start on %s: %v", addr, err)
		return
	}
}
