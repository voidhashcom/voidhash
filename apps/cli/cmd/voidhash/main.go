// Command voidhash manages Voidhash projects from the terminal.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cmd"
)

// version is set at build time: -ldflags "-X main.version=1.2.3".
var version = "dev"

func main() {
	app, err := cli.NewApp(version)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(cli.ExitFailure)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	code := app.Execute(ctx, cmd.NewRoot(app), os.Args[1:])
	stop()
	os.Exit(code)
}
