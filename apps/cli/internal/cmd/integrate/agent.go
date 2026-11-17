package integrate

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/integrate"
)

// logPath is where the agent's raw output of a run is kept, for when
// something goes wrong.
const logPath = integrate.StateDir + "/agent.log"

// writeTask writes the agent's task from what the run knows now. It is
// written on every run, so it always matches the project.
func (r *run) writeTask() (string, error) {
	r.facts.Done = r.doneList()
	r.facts.ToldSeparately = append([]string{"Start the app and watch its first events arrive."}, r.platform.LeftForYou...)
	task, err := integrate.Task(r.facts)
	if err != nil {
		return "", err
	}
	if err := integrate.WriteStateFile(r.app.Dir, "task.md", task); err != nil {
		return "", cli.Failf("Could not write %s: %s.", integrate.TaskPath, err)
	}
	return task, nil
}

// doneList tells the agent what is already in place.
func (r *run) doneList() []string {
	var done []string
	if len(r.platform.Packages) > 0 {
		done = append(done, "The SDK is installed: "+packageNames(r.platform.Packages)+" are in package.json.")
	}
	done = append(done, "`voidhash.json` names the project.")
	for _, file := range r.platform.Files {
		if file.Role == "client" && r.facts.ClientFile != "" {
			done = append(done, "`"+r.facts.ClientFile+"` creates the SDK client with the project's keys. If it was there before this run, it may differ from what this document shows: read it, and use it as it is.")
		}
	}
	if len(r.env) > 0 {
		names := make([]string, len(r.env))
		for index, line := range r.env {
			names[index] = "`" + line.name + "`"
		}
		done = append(done, "`"+r.facts.EnvFile+"` defines "+strings.Join(names, ", ")+".")
	}
	if len(r.facts.TypesFiles) > 0 {
		done = append(done, "The project's slugs are generated as types in `"+strings.Join(r.facts.TypesFiles, "`, `")+"`.")
	}
	if len(r.create) > 0 || r.facts.Perk != "" || r.facts.Product != "" {
		done = append(done, "The perks, products and locations listed above exist in the project.")
	}
	return done
}

// job is a run of the agent on task.
func (r *run) job(task, session string, log *os.File) integrate.Job {
	style := r.app.ErrStyle()
	last := ""
	return integrate.Job{
		Dir: r.app.Dir, Task: task, Session: session, Model: r.model, Commands: r.checks, Log: log,
		Progress: func(step integrate.Step) {
			// Reads are many and say little.
			if step.Kind == integrate.StepRead && !r.app.Debug {
				return
			}
			line := step.Kind + " " + strings.SplitN(strings.TrimSpace(step.Detail), "\n", 2)[0]
			if step.Kind == integrate.StepDenied {
				line = "refused: " + step.Detail + ", which is outside what the agent may do"
			}
			if step.Kind == integrate.StepStrayed {
				r.app.Warnf("%s changed %s, which its task told it not to touch. Look at that file before you keep the result.", r.agent.Name(), cli.Printable(step.Detail))
				return
			}
			if line != last {
				r.app.Notef("%s", style.Dim("    "+cli.Printable(line)))
				last = line
			}
		},
	}
}

// runAgent gives the agent its task, or writes the task for the person
// when there is no agent. An agent that already finished is not run again.
func (r *run) runAgent(ctx context.Context) error {
	task, err := r.writeTask()
	if err != nil {
		return err
	}
	if r.agent == nil {
		if r.state.AgentStage != integrate.AgentHandedOff {
			r.state.AgentStage = integrate.AgentHandedOff
			r.result.handedOffNow = true
			return r.save()
		}
		return nil
	}
	if r.state.AgentStage == integrate.AgentFinished && r.state.Agent == r.agent.ID() {
		r.step("%s already did its part in an earlier run", r.agent.Name())
		return nil
	}
	session := ""
	if r.state.AgentStage == integrate.AgentRunning && r.state.Agent == r.agent.ID() && r.state.Session != "" {
		// An interrupted run: the same conversation picks the work up.
		session, task = r.state.Session, integrate.ContinueTask
		r.app.Notef("%s continues the run that was interrupted…", r.agent.Name())
	} else {
		r.app.Notef("%s is wiring the SDK into your code. Its task is in %s…", r.agent.Name(), integrate.TaskPath)
	}
	return r.askAgent(ctx, task, session)
}

// askAgent runs the agent once and records how it ended. The record is
// written before it starts and after it ends, so a run that is stopped in
// between is known to be unfinished.
func (r *run) askAgent(ctx context.Context, task, session string) error {
	r.state.Agent, r.state.AgentStage, r.state.Session = r.agent.ID(), integrate.AgentRunning, session
	r.state.Model = r.model
	if err := r.save(); err != nil {
		return err
	}
	log, err := os.OpenFile(filepath.Join(r.app.Dir, filepath.FromSlash(logPath)), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return cli.Failf("Could not write %s: %s.", logPath, err)
	}
	defer log.Close()

	limited, cancel := context.WithTimeout(ctx, r.opts.timeout)
	defer cancel()
	outcome, err := r.agent.Run(limited, r.app.RunProcess, r.job(task, session, log))
	if outcome.Session != "" {
		r.state.Session = outcome.Session
	}
	switch {
	case ctx.Err() != nil:
		_ = r.save()
		r.app.Warnf("Stopped. Your project has the changes made so far ('git status' lists them). Run 'voidhash integrate' again to continue where it stopped, or with --restart to start over.")
		return ctx.Err()
	case limited.Err() != nil:
		_ = r.save()
		return cli.Failf("%s did not finish within %s. Your project has the changes made so far ('git status' lists them).", r.agent.Name(), short(r.opts.timeout)).
			WithHint("Run 'voidhash integrate' again to continue where it stopped, or pass a longer --timeout.")
	case err != nil:
		_ = r.save()
		return cli.Failf("%s could not be run: %s.", r.agent.Name(), err).
			WithHint("Run 'voidhash integrate --agent none' to get the task to follow yourself.")
	case outcome.Failed:
		_ = r.save()
		reason := strings.TrimSpace(outcome.Message)
		if reason == "" {
			reason = "it ended with exit code " + strconv.Itoa(outcome.ExitCode)
		}
		return cli.Failf("%s stopped with an error: %s", r.agent.Name(), cli.PrintableLines(reason)).
			WithHint("Check that '" + r.agent.Program() + "' works by itself (it may need you to sign in), then run 'voidhash integrate' again. Its output is in " + logPath + ".")
	}
	r.state.AgentStage = integrate.AgentFinished
	if report, ok := integrate.ParseReport(outcome.Message); ok {
		r.state.Report = &report
	} else {
		r.state.Report = nil
		r.app.Warnf("%s ended without the report it was asked for, so only what the CLI checks itself is known.", r.agent.Name())
	}
	r.result.agentRan = true
	return r.save()
}
