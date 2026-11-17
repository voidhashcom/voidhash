package experiment

import (
	"context"
	"math"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/voidhashcom/voidhash/apps/cli/internal/cli"
	"github.com/voidhashcom/voidhash/apps/cli/internal/flags"
)

// The arms of an experiment as the command line describes them: --arm for
// each, with the paywalls it shows; --flag for each flag the arms set, one
// value per arm; --weights for their shares.

// armFlags are the flags `create` and `edit` describe the arms with.
type armFlags struct {
	location *string
	arm      *[]string
	control  *string
	weights  *string
	flag     *[]string
}

func addArmFlags(cmd *cobra.Command) armFlags {
	return armFlags{
		location: cmd.Flags().String("location", "", "The paywall location every --arm NAME=PAYWALL shows at"),
		arm:      cli.AddStringsFlag(cmd, "arm", "", "An arm as `NAME=PAYWALL` (with --location) or NAME=LOCATION:PAYWALL[,LOCATION:PAYWALL], the control first. Replaces the arms"),
		control:  cmd.Flags().String("control", "", "Which --arm is the control, by its `name` (default: the first)"),
		weights:  cmd.Flags().String("weights", "", "The `shares` of the arms, in the order of --arm, such as 60,40 (default: even)"),
		flag:     cli.AddStringsFlag(cmd, "flag", "", "A feature flag the arms set, as `KEY=VALUE,VALUE` with one value per --arm, in order: on, off, or one of the flag's variant keys; an --arm needs no paywall then"),
	}
}

// given reports whether the command line describes arms at all.
func (f armFlags) given() bool { return len(*f.arm) > 0 || len(*f.flag) > 0 }

// armSpec is one --arm as typed: its name, and the paywalls it shows.
type armSpec struct {
	name       string
	placements []placementSpec
}

// placementSpec is one PAYWALL or LOCATION:PAYWALL of an --arm. location is
// empty when --location decides.
type placementSpec struct {
	location string
	paywall  string
}

// parseArmSpec reads one --arm: NAME, NAME=PAYWALL or
// NAME=LOCATION:PAYWALL[,LOCATION:PAYWALL].
func parseArmSpec(spec string) armSpec {
	name, rest, _ := strings.Cut(spec, "=")
	parsed := armSpec{name: strings.TrimSpace(name)}
	if rest = strings.TrimSpace(rest); rest == "" {
		return parsed
	}
	for _, part := range strings.Split(rest, ",") {
		pieces := strings.Split(part, ":")
		if len(pieces) == 1 {
			parsed.placements = append(parsed.placements, placementSpec{paywall: strings.TrimSpace(pieces[0])})
		} else {
			parsed.placements = append(parsed.placements, placementSpec{
				location: strings.TrimSpace(pieces[0]), paywall: strings.TrimSpace(pieces[1]),
			})
		}
	}
	return parsed
}

// flagSpec is one --flag as typed: the flag's key, and a value per arm.
type flagSpec struct {
	key    string
	values []string
}

// parseFlagSpec reads one --flag KEY=VALUE,VALUE, which needs a value for
// each of the arms.
func parseFlagSpec(spec string, arms int) (flagSpec, error) {
	key, rest, _ := strings.Cut(spec, "=")
	parsed := flagSpec{key: strings.TrimSpace(key)}
	for _, value := range strings.Split(rest, ",") {
		parsed.values = append(parsed.values, strings.TrimSpace(value))
	}
	complete := len(parsed.values) == arms
	for _, value := range parsed.values {
		complete = complete && value != ""
	}
	if !complete {
		return flagSpec{}, cli.Usagef("--flag %s needs one value per --arm, in order.", spec).
			WithHint("Each is on, off or one of the flag's variant keys: " + flagsUsage)
	}
	return parsed, nil
}

// flagValueFor is what an arm gives a flag: on and off switch it; anything
// else is one of its variants, and turns it on.
func flagValueFor(flagID, typed string) flagValue {
	value := flagValue{FeatureFlagID: flagID, IsEnabled: !strings.EqualFold(typed, "off")}
	if !strings.EqualFold(typed, "on") && !strings.EqualFold(typed, "off") {
		value.VariantKey = &typed
	}
	return value
}

// parseWeights reads --weights: a share per arm, in hundredths of a
// percent, totalling 100%. Without it the arms split evenly, and the
// control takes what an even split leaves over.
func parseWeights(input string, arms, control int) ([]int, error) {
	weights := make([]int, arms)
	if input == "" {
		even := 10_000 / arms
		for index := range weights {
			weights[index] = even
		}
		weights[control] += 10_000 - even*arms
		return weights, nil
	}
	refuse := cli.Usagef("--weights needs one share per --arm, totalling 100.").
		WithHint("Such as --weights 60,40, or leave it out for an even split.")
	parts := strings.Split(input, ",")
	if len(parts) != arms {
		return nil, refuse
	}
	total := 0.0
	for index, part := range parts {
		share, err := strconv.ParseFloat(strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(part), "%")), 64)
		if err != nil || math.IsInf(share, 0) || math.IsNaN(share) {
			return nil, refuse
		}
		total += share
		weights[index] = int(math.Round(share * 100))
	}
	if math.Round(total*100) != 10_000 {
		return nil, refuse
	}
	return weights, nil
}

// newArm is an arm as `PUT …/variants` takes it. An arm kept from before
// carries its id, so its end users stay in it.
type newArm struct {
	ID               string      `json:"id,omitempty"`
	Name             string      `json:"name"`
	IsControl        bool        `json:"isControl"`
	WeightPercentage float64     `json:"weightPercentage"`
	Placements       []placement `json:"placements"`
	FlagValues       []flagValue `json:"flagValues"`
}

// parseArms is the arms the command line describes, with their placements
// and flags resolved and existing arms of the same name kept. removed are
// the existing arms that are left out.
func parseArms(ctx context.Context, app *cli.App, projectID string, given armFlags, existing []arm) (variants []newArm, removed []arm, err error) {
	if len(*given.arm) < 2 {
		return nil, nil, cli.Usagef("An experiment needs at least two arms.").
			WithHint("Pass an --arm for each: " + armsUsage + ", or " + flagsUsage)
	}
	// Everything typed is read before anything is looked up.
	specs := make([]armSpec, len(*given.arm))
	needsPlaces := *given.location != ""
	for index, typed := range *given.arm {
		specs[index] = parseArmSpec(typed)
		needsPlaces = needsPlaces || len(specs[index].placements) > 0
	}
	flagSpecs := make([]flagSpec, len(*given.flag))
	for index, typed := range *given.flag {
		if flagSpecs[index], err = parseFlagSpec(typed, len(specs)); err != nil {
			return nil, nil, err
		}
	}
	control := 0
	if *given.control != "" {
		control = -1
		for index, spec := range specs {
			if control < 0 && strings.EqualFold(spec.name, *given.control) {
				control = index
			}
		}
		if control < 0 {
			return nil, nil, cli.Usagef("No --arm is named %s.", *given.control).WithHint("--control names one of the --arm names.")
		}
	}
	weights, err := parseWeights(*given.weights, len(specs), control)
	if err != nil {
		return nil, nil, err
	}

	// Each --flag gives every arm a value, in the order of --arm.
	flagIDs := make([]string, len(flagSpecs))
	if len(flagSpecs) > 0 {
		inUse, err := flags.List(ctx, app, projectID, false)
		if err != nil {
			return nil, nil, err
		}
		for index, spec := range flagSpecs {
			flag, err := cli.FindItem(flags.Kind, inUse.Items, spec.key)
			if err != nil {
				return nil, nil, err
			}
			flagIDs[index] = flag.ID
		}
	}
	var where places
	var defaultLocation *place
	if needsPlaces {
		if where, err = listPlaces(ctx, app, projectID); err != nil {
			return nil, nil, err
		}
		if *given.location != "" {
			location, err := cli.FindItem(locationKind, where.locations, *given.location)
			if err != nil {
				return nil, nil, err
			}
			defaultLocation = &location
		}
	}

	kept := map[string]bool{}
	for index, spec := range specs {
		variant := newArm{
			Name: spec.name, IsControl: index == control, WeightPercentage: float64(weights[index]) / 100,
			Placements: []placement{}, FlagValues: []flagValue{},
		}
		for _, shown := range spec.placements {
			location := defaultLocation
			if shown.location != "" {
				found, err := cli.FindItem(locationKind, where.locations, shown.location)
				if err != nil {
					return nil, nil, err
				}
				location = &found
			}
			if location == nil {
				return nil, nil, cli.Usagef("Where does arm %s show %s?", spec.name, shown.paywall).
					WithHint("Pass --location, or write it as NAME=LOCATION:PAYWALL: " + armsUsage)
			}
			paywall, err := cli.FindItem(paywallKind, where.paywalls, shown.paywall)
			if err != nil {
				return nil, nil, err
			}
			variant.Placements = append(variant.Placements, placement{PaywallLocationID: location.ID, PaywallID: paywall.ID})
		}
		for at, spec := range flagSpecs {
			variant.FlagValues = append(variant.FlagValues, flagValueFor(flagIDs[at], spec.values[index]))
		}
		for _, candidate := range existing {
			if strings.EqualFold(candidate.Name, spec.name) {
				variant.ID = candidate.ID
				kept[candidate.ID] = true
				break
			}
		}
		variants = append(variants, variant)
	}
	for _, candidate := range existing {
		if !kept[candidate.ID] {
			removed = append(removed, candidate)
		}
	}
	return variants, removed, nil
}
