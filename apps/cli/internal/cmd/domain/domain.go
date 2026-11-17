// Package domain holds `voidhash domain`: the tracking domains a project
// serves the web SDK from.
package domain

import (
	"fmt"
	"net/http"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
)

type domain = api.TrackingDomainJsonEncoding

// New creates `voidhash domain`.
func New(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "domain",
		Aliases: []string{"domains"},
		Short:   "Tracking domains: serve the web SDK from your own subdomain.",
		Long:    "Tracking domains: serve the web SDK from your own subdomain. List, add, verify and remove them.",
	}
	cmd.AddCommand(newList(app), newAdd(app), newVerify(app), newRemove(app))
	return cmd
}

var domainKind = cli.ItemKind[domain]{
	Noun:          "tracking domain",
	ID:            func(d domain) string { return d.Id },
	Label:         func(d domain) string { return d.Hostname },
	ListCommand:   "voidhash domain list",
	CreateCommand: "voidhash domain add",
	Keys:          func(d domain) []string { return []string{d.Hostname} },
}

var domainArg = cli.Arg{Name: "domain", Help: "The tracking domain's hostname or id", Optional: true}

// statusLabels is where a tracking domain's setup stands, as people say it.
var statusLabels = map[api.TrackingDomainStatus]string{
	api.TrackingDomainStatusPendingDns:         "waiting for DNS",
	api.TrackingDomainStatusPendingCertificate: "waiting for its certificate",
	api.TrackingDomainStatusActive:             "active",
	api.TrackingDomainStatusFailed:             "failed",
}

func statusOf(d domain) string {
	if label, ok := statusLabels[d.Status]; ok {
		return label
	}
	return string(d.Status)
}

var purposes = map[api.TrackingDomainDnsRecordJsonEncodingPurpose]string{
	api.Routing:     "routes requests, and proves the domain is yours",
	api.Ownership:   "proves it is yours where the CNAME is flattened or proxied",
	api.Certificate: "optional: speeds up its certificate",
}

// nextStep is what a domain in its status is waiting for, and what to do
// about it.
func nextStep(d domain) string {
	verify := fmt.Sprintf("'voidhash domain verify %s'", d.Hostname)
	switch d.Status {
	case api.TrackingDomainStatusActive:
		return fmt.Sprintf("It serves your web SDK's requests. Point the SDK at https://%s.", d.Hostname)
	case api.TrackingDomainStatusPendingCertificate:
		return "Its DNS is set up; its certificate is being issued, usually within minutes. Check again with " + verify + "."
	case api.TrackingDomainStatusFailed:
		reason := "It could not be set up."
		if d.FailureReason != nil {
			reason = *d.FailureReason
		}
		return reason + " Fix the DNS records ('voidhash domain list' shows them), then run " + verify + "."
	default:
		type record = api.TrackingDomainDnsRecordJsonEncoding
		records := cli.FormatTable([]cli.Column[record]{
			{Header: "TYPE", Cell: func(r record) string { return string(r.Type) }},
			{Header: "NAME", Cell: func(r record) string { return r.Name }},
			{Header: "VALUE", Cell: func(r record) string { return r.Value }},
			{Header: "PURPOSE", Cell: func(r record) string { return purposes[r.Purpose] }},
		}, d.DnsRecords, nil)
		return "Create these records at your DNS provider; the CNAME is enough unless your provider flattens or proxies it:\n" +
			records + "\nThen run " + verify + ". A domain whose DNS is not set up within seven days is removed."
	}
}

var domainHints = map[string]string{
	"invalid_tracking_domain":      "Use a subdomain of a domain you own, such as t.example.com, that the project does not have yet; a project has at most five ('voidhash domain list').",
	"tracking_domains_unavailable": "This Voidhash server does not host tracking domains; proxy the web SDK's requests through your own server instead.",
}

func listDomains(cmd *cobra.Command, app *cli.App, projectID string) (cli.List[domain], error) {
	ctx := cmd.Context()
	return cli.ListAll[domain](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.TrackingDomainsList(ctx, projectID, &api.TrackingDomainsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
}

func newList(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "list",
		Short:   "List the project's tracking domains, with what each still needs before it serves.",
		Example: "voidhash domain list\nvoidhash domain list --json",
	}
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		domains, err := listDomains(cmd, app, target.Project.Id)
		if err != nil {
			return err
		}
		switch mode {
		case cli.JSON:
			return app.PrintJSON(domains)
		case cli.Quiet:
			app.PrintIDs(domains)
			return nil
		}
		cli.PrintTable(app, []cli.Column[domain]{
			{Header: "HOSTNAME", Cell: func(d domain) string { return d.Hostname }},
			{Header: "STATUS", Cell: statusOf},
			{Header: "CHECKED", Cell: func(d domain) string {
				if d.LastCheckedAt == nil {
					return "-"
				}
				return app.FormatTimeAgo(*d.LastCheckedAt)
			}},
			{Header: "ID", Cell: func(d domain) string { return d.Id }},
		}, domains.Items, "No tracking domains yet. Serve the web SDK from your own domain with 'voidhash domain add t.example.com'.")
		for _, d := range domains.Items {
			if d.Status != api.TrackingDomainStatusActive {
				app.Notef("\n%s", cli.PrintableLines(d.Hostname+": "+nextStep(d)))
			}
		}
		return nil
	}
	return cmd
}

func newAdd(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "add",
		Short:   "Serve the web SDK from your own subdomain.",
		Long:    "Serve the web SDK from your own subdomain: adds it to the project and prints the DNS records to create.",
		Example: "voidhash domain add t.example.com",
	}
	cli.SetArgs(cmd, cli.Arg{Name: "hostname", Help: "A subdomain you own, such as t.example.com", Optional: true})
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		hostname, err := app.RequireText(ctx, cli.ArgAt(args, 0), cli.TextPrompt{
			What: "the hostname", Message: "Hostname, such as t.example.com", Usage: "voidhash domain add <hostname>",
		})
		if err != nil {
			return err
		}
		created, err := cli.Fetch[domain](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.TrackingDomainsCreate(ctx, target.Project.Id, api.CreateTrackingDomainBodyJsonEncoding{Hostname: hostname})
		})
		if err != nil {
			return cli.APIError(err, domainHints)
		}
		return app.PrintItem(mode, created, fmt.Sprintf("Added %s (%s) to %s.\n%s",
			created.Value.Hostname, created.Value.Id, target.Label(), nextStep(created.Value)))
	}
	return cmd
}

func newVerify(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "verify",
		Short:   "Check a tracking domain's DNS and certificate now, and say what it still needs.",
		Example: "voidhash domain verify t.example.com",
	}
	cli.SetArgs(cmd, domainArg)
	project := cli.AddProjectFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		domains, err := listDomains(cmd, app, target.Project.Id)
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, domainKind, domains.Items, cli.ArgAt(args, 0), "voidhash domain verify <domain>")
		if err != nil {
			return err
		}
		checked, err := cli.Fetch[domain](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.TrackingDomainsVerify(ctx, target.Project.Id, found.Id)
		})
		if err != nil {
			return err
		}
		return app.PrintItem(mode, checked, fmt.Sprintf("%s is %s.\n%s", checked.Value.Hostname, statusOf(checked.Value), nextStep(checked.Value)))
	}
	return cmd
}

func newRemove(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "remove",
		Short:   "Stop serving a tracking domain and remove it.",
		Long:    "Stop serving a tracking domain and remove it. Asks first; --yes skips that.",
		Example: "voidhash domain remove t.example.com\nvoidhash domain remove t.example.com --yes",
	}
	cli.SetArgs(cmd, domainArg)
	project := cli.AddProjectFlag(cmd)
	yes := cli.AddYesFlag(cmd)
	output := cli.AddOutputFlags(cmd)
	cmd.RunE = func(cmd *cobra.Command, args []string) error {
		ctx := cmd.Context()
		mode, err := output.Mode()
		if err != nil {
			return err
		}
		target, err := app.ResolveProject(ctx, *project)
		if err != nil {
			return err
		}
		domains, err := listDomains(cmd, app, target.Project.Id)
		if err != nil {
			return err
		}
		found, err := cli.RequireItem(ctx, app, domainKind, domains.Items, cli.ArgAt(args, 0), "voidhash domain remove <domain> --yes")
		if err != nil {
			return err
		}
		question := fmt.Sprintf("Remove %s from %s?", found.Hostname, target.Label())
		if found.Status == api.TrackingDomainStatusActive {
			question += " Web SDK requests sent through it stop arriving, so point the SDK elsewhere first."
		}
		if err := app.ConfirmChange(ctx, *yes, question); err != nil {
			return err
		}
		if err := cli.Call(ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.TrackingDomainsDelete(ctx, target.Project.Id, found.Id)
		}); err != nil {
			return err
		}
		removed := domains.Filter(func(d domain) bool { return d.Id == found.Id }).Object(0)
		return app.PrintItem(mode, removed, fmt.Sprintf("Removed %s. You can delete its DNS records now.", found.Hostname))
	}
	return cmd
}
