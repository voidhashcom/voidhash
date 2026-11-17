package person

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash-go/api"
	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/paywalls"
)

type (
	subscription = api.PersonSubscriptionJsonEncoding
	purchase     = api.PersonPurchaseJsonEncoding
	entitlement  = api.PersonEntitlementJsonEncoding
)

// history is what a person bought and can use.
type history struct {
	subscriptions cli.List[subscription]
	purchases     cli.List[purchase]
	// entitlements are only known when canSeeEntitlements.
	entitlements       cli.List[entitlement]
	canSeeEntitlements bool
}

// readHistory reads what a person bought and can use, every page.
func readHistory(ctx context.Context, app *cli.App, projectID, personID string) (history, error) {
	var read history
	var err error
	read.subscriptions, err = cli.ListAll[subscription](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PersonsListSubscriptions(ctx, projectID, personID, &api.PersonsListSubscriptionsParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	if err != nil {
		return read, err
	}
	read.purchases, err = cli.ListAll[purchase](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PersonsListPurchases(ctx, projectID, personID, &api.PersonsListPurchasesParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	if err != nil {
		return read, err
	}
	read.entitlements, err = cli.ListAll[entitlement](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.PersonsListEntitlements(ctx, projectID, personID, &api.PersonsListEntitlementsParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	read.canSeeEntitlements, err = cli.IfPermitted(err)
	return read, err
}

// isBefore reports whether the API time iso is at or before now; false when
// it is absent or unreadable.
func isBefore(iso *string, now time.Time) bool {
	if iso == nil {
		return false
	}
	parsed, err := time.Parse(time.RFC3339Nano, *iso)
	return err == nil && !parsed.After(now)
}

// subscriptionState is where a subscription stands now: active, canceling,
// grace period, lapsed or ended.
func subscriptionState(sub subscription, now time.Time) string {
	switch {
	case sub.Status == "canceled":
		return "ended"
	case !isBefore(sub.ExpiresAt, now):
		if sub.IsCancelingAtPeriodEnd {
			return "canceling"
		}
		return "active"
	case sub.GracePeriodExpiresAt != nil && !isBefore(sub.GracePeriodExpiresAt, now):
		return "grace period"
	default:
		return "lapsed"
	}
}

func isCurrent(sub subscription, now time.Time) bool {
	state := subscriptionState(sub, now)
	return state != "ended" && state != "lapsed"
}

func isOwned(bought purchase) bool { return bought.RefundedAt == nil && bought.RevokedAt == nil }

// environmentNote marks what is not production: " [test]".
func environmentNote(environment string) string {
	if environment == "production" {
		return ""
	}
	return " [" + environment + "]"
}

func dateOf(app *cli.App, iso *string) string {
	if iso == nil {
		return "-"
	}
	return app.FormatDate(*iso)
}

func describeSubscription(app *cli.App, sub subscription) string {
	var how string
	switch subscriptionState(sub, app.Now()) {
	case "active":
		how = "active"
		if sub.ExpiresAt != nil {
			how = "active, renews " + dateOf(app, sub.ExpiresAt)
		}
	case "canceling":
		how = "canceled, access ends " + dateOf(app, sub.ExpiresAt)
	case "grace period":
		how = "payment failed, grace period until " + dateOf(app, sub.GracePeriodExpiresAt)
	case "lapsed":
		how = "expired " + dateOf(app, sub.ExpiresAt) + " without renewing"
	default:
		how = "ended " + dateOf(app, sub.ExpiresAt)
	}
	return sub.ProductName + environmentNote(string(sub.Environment)) + ": " + how
}

func describePurchase(app *cli.App, bought purchase) string {
	var how string
	switch {
	case bought.RefundedAt != nil:
		how = "refunded " + app.FormatDate(*bought.RefundedAt)
	case bought.RevokedAt != nil:
		how = "revoked " + app.FormatDate(*bought.RevokedAt)
	default:
		how = "bought " + dateOf(app, bought.CreatedAt)
	}
	return bought.ProductName + environmentNote(string(bought.Environment)) + ": " + how
}

func describeEntitlement(app *cli.App, granted entitlement, read history) string {
	product := ""
	if granted.SourceId != nil {
		if granted.Source == "subscription" {
			for _, sub := range read.subscriptions.Items {
				if sub.Id == *granted.SourceId {
					product = sub.ProductName
				}
			}
		} else {
			for _, bought := range read.purchases.Items {
				if bought.Id == *granted.SourceId {
					product = bought.ProductName
				}
			}
		}
	}
	source := string(granted.Source)
	from := "from a " + source
	switch {
	case source == "manual":
		from = "granted manually"
	case product != "":
		from = product + " " + source
	}
	perk := "deleted perk " + granted.PerkId
	if granted.PerkSlug != nil {
		perk = *granted.PerkSlug
	}
	until := ""
	if granted.ExpiresAt != nil {
		until = ", until " + app.FormatDate(*granted.ExpiresAt)
	}
	return perk + ": " + from + until
}

// How many of the project's newest events `person view` searches for the
// person's.
const eventScan = 300

// event is the part of an analytics event `person view` reads.
type event struct {
	Name       string  `json:"name"`
	Timestamp  string  `json:"timestamp"`
	PersonID   *string `json:"personId"`
	DistinctID string  `json:"distinctId"`
}

// recentEventsOf finds the person's events among the project's newest
// [eventScan]; events cannot be filtered by person.
func recentEventsOf(ctx context.Context, app *cli.App, projectID string, person paywalls.Person) (cli.List[event], error) {
	var scanned cli.List[event]
	limit := 100
	var cursor *string
	for {
		page, info, err := cli.FetchPage[event](ctx, app, func(c *api.Client) (*http.Response, error) {
			return c.EventsList(ctx, projectID, &api.EventsListParams{Limit: &limit, Cursor: cursor})
		})
		if err != nil {
			return scanned, err
		}
		scanned.Items = append(scanned.Items, page.Items...)
		scanned.Raw = append(scanned.Raw, page.Raw...)
		if !info.HasNextPage || info.EndCursor == nil || len(scanned.Items) >= eventScan {
			break
		}
		cursor = info.EndCursor
	}
	return scanned.Filter(func(seen event) bool {
		return (seen.PersonID != nil && *seen.PersonID == person.Id) || seen.DistinctID == person.DistinctId
	}), nil
}

// override is a flag override naming one end user.
type override struct {
	FeatureFlagID string  `json:"featureFlagId"`
	IdentityType  string  `json:"identityType"`
	IsEnabled     *bool   `json:"isEnabled"`
	VariantKey    *string `json:"variantKey"`
}

// overridesOf reads the flag overrides naming the person by id, distinct id
// or email, and the keys of the project's flags by id.
func overridesOf(ctx context.Context, app *cli.App, projectID string, person paywalls.Person) (cli.List[override], map[string]string, error) {
	identities := []string{"person_id:" + person.Id, "distinct_id:" + person.DistinctId}
	if person.Email != nil {
		identities = append(identities, "email:"+*person.Email)
	}
	var overrides cli.List[override]
	byIdentity, err := cli.Each(ctx, identities, 3, func(ctx context.Context, identity string) (cli.List[override], error) {
		return cli.ListAll[override](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
			return c.FeatureFlagsListOverridesByIdentity(ctx, projectID, &api.FeatureFlagsListOverridesByIdentityParams{Cursor: page.Cursor, Limit: page.Limit, Identity: identity})
		})
	})
	if err != nil {
		return overrides, nil, err
	}
	for _, found := range byIdentity {
		overrides.Items = append(overrides.Items, found.Items...)
		overrides.Raw = append(overrides.Raw, found.Raw...)
	}
	flags, err := cli.ListAll[struct {
		ID  string `json:"id"`
		Key string `json:"key"`
	}](ctx, app, func(c *api.Client, page cli.Page) (*http.Response, error) {
		return c.FeatureFlagsList(ctx, projectID, &api.FeatureFlagsListParams{Cursor: page.Cursor, Limit: page.Limit})
	})
	if err != nil {
		return overrides, nil, err
	}
	keys := map[string]string{}
	for _, flag := range flags.Items {
		keys[flag.ID] = flag.Key
	}
	return overrides, keys, nil
}

func describeOverride(set override, flagKeys map[string]string) string {
	value := "unchanged"
	switch {
	case set.VariantKey != nil:
		value = "variant " + *set.VariantKey
	case set.IsEnabled != nil && *set.IsEnabled:
		value = "on"
	case set.IsEnabled != nil:
		value = "off"
	}
	flag := set.FeatureFlagID
	if key := flagKeys[flag]; key != "" {
		flag = key
	}
	return flag + ": " + value + " (by " + strings.Replace(set.IdentityType, "_", " ", 1) + ")"
}

func lines(items []string, empty string) string {
	if len(items) == 0 {
		return empty
	}
	return strings.Join(items, "\n")
}

// pathSegment is text as one segment of a dashboard address.
func pathSegment(text string) string {
	return strings.ReplaceAll(url.QueryEscape(text), "+", "%20")
}

// newView creates `voidhash person view <person>`.
func newView(app *cli.App) *cobra.Command {
	cmd := &cobra.Command{
		Use:   "view",
		Short: "Show a person: their profile, access, subscriptions, purchases, flag overrides and recent events.",
		Long: `Show a person: their profile, the perks they can use and why, their subscriptions and purchases, the flag overrides naming them, and their recent events.

Only production store purchases are shown. Recent events are those among the project's 300 newest. With --json the person is printed with entitlements, subscriptions, purchases, flagOverrides and recentEvents added; a part your access does not include is null.`,
		Example: `voidhash person view ada@example.com
voidhash person view distinct_id:user-42 --json`,
	}
	cli.SetArgs(cmd, personArg)
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
		projectID := target.Project.Id
		found, err := paywalls.RequirePerson(ctx, app, projectID, cli.ArgAt(args, 0), "voidhash person view <person>")
		if err != nil {
			return err
		}
		if mode == cli.Quiet {
			app.PrintIDs(found)
			return nil
		}
		person := found.Value
		var (
			read                          history
			overrides                     cli.List[override]
			flagKeys                      map[string]string
			events                        cli.List[event]
			canSeeOverrides, canSeeEvents bool
		)
		if err := cli.Together(ctx,
			func(ctx context.Context) (err error) {
				read, err = readHistory(ctx, app, projectID, person.Id)
				return err
			},
			func(ctx context.Context) (err error) {
				overrides, flagKeys, err = overridesOf(ctx, app, projectID, person)
				canSeeOverrides, err = cli.IfPermitted(err)
				return err
			},
			func(ctx context.Context) (err error) {
				events, err = recentEventsOf(ctx, app, projectID, person)
				canSeeEvents, err = cli.IfPermitted(err)
				return err
			},
		); err != nil {
			return err
		}

		if mode == cli.JSON {
			members := []paywalls.Member{
				{Key: "entitlements"},
				{Key: "subscriptions", Value: read.subscriptions.RawJSON()},
				{Key: "purchases", Value: read.purchases.RawJSON()},
				{Key: "flagOverrides"},
				{Key: "recentEvents"},
			}
			if read.canSeeEntitlements {
				members[0].Value = read.entitlements.RawJSON()
			}
			if canSeeOverrides {
				members[3].Value = overrides.RawJSON()
			}
			if canSeeEvents {
				newest := events
				if len(newest.Raw) > 20 {
					newest.Items, newest.Raw = newest.Items[:20], newest.Raw[:20]
				}
				members[4].Value = newest.RawJSON()
			}
			return app.PrintJSON(paywalls.ExtendObject(found.Raw, members...))
		}

		const hidden = "not shown: your access does not include it"
		access := hidden
		if read.canSeeEntitlements {
			var granted []string
			for _, item := range read.entitlements.Items {
				granted = append(granted, describeEntitlement(app, item, read))
			}
			access = lines(granted, "none; 'voidhash person why "+person.Id+" <perk>' explains why")
		}
		var subscriptions, purchases []string
		for _, sub := range read.subscriptions.Items {
			subscriptions = append(subscriptions, describeSubscription(app, sub))
		}
		for _, bought := range read.purchases.Items {
			purchases = append(purchases, describePurchase(app, bought))
		}
		flagOverrides := hidden
		if canSeeOverrides {
			var set []string
			for _, item := range overrides.Items {
				set = append(set, describeOverride(item, flagKeys))
			}
			flagOverrides = lines(set, "none")
		}
		recent := hidden
		if canSeeEvents {
			var seen []string
			for index, item := range events.Items {
				if index == 10 {
					break
				}
				seen = append(seen, item.Name+"  "+app.FormatTimeAgo(item.Timestamp))
			}
			recent = lines(seen, "none among the project's 300 newest events")
		}
		firstSeen := "-"
		if person.CreatedAt != nil {
			firstSeen = app.FormatTimeAgo(*person.CreatedAt)
		}
		fields := []cli.Field{
			{Label: "Distinct id", Value: person.DistinctId},
			{Label: "Email", Value: orDash(person.Email)},
			{Label: "First seen", Value: firstSeen},
			{Label: "Access", Value: access},
			{Label: "Subscriptions", Value: lines(subscriptions, "none")},
			{Label: "Purchases", Value: lines(purchases, "none")},
			{Label: "Flag overrides", Value: flagOverrides},
			{Label: "Recent events", Value: recent},
			{Label: "ID", Value: person.Id},
		}
		settings, err := app.Config()
		if err != nil {
			return err
		}
		if address, ok := cli.DashboardURL(settings.WebURL, target, "persons/"+pathSegment(person.DistinctId)); ok {
			fields = append(fields, cli.Field{Label: "Dashboard", Value: address})
		}
		title := paywalls.PersonName(person)
		if !person.IsIdentified {
			title += " (anonymous)"
		}
		app.Println(title + "\n" + cli.FormatFields(fields))
		app.Notef("Only production store purchases are shown. Attributes are shown in the dashboard.")
		return nil
	}
	return cmd
}
