package experiment

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// How an arm's conversions compare to the control's, read so the answer
// never overclaims. Every surface that reports experiment results reads
// them by these rules, so they reach the same verdict; this is how the CLI
// words it.
//
// Results are read again and again while a test runs, so the verdict is a
// sequential test whose 5% false-winner risk holds at every look: a mixture
// sequential probability ratio test on the pooled two-proportion z, with a
// normal mixture over the standardised effect (Johari, Koomen, Pekelis and
// Walsh, "Always valid inference: continuous monitoring of A/B tests",
// Operations Research, 2022). With n the effective people of the comparison
// and r = tau^2 * n, the likelihood ratio against no difference is
// (1 + r)^(-1/2) * exp(r / (1 + r) * z^2 / 2), and 1 over it is the
// always-valid p-value.

const (
	// Below this many exposed end users in an arm (or the control), a
	// comparison says nothing yet.
	minExposures = 100
	// Below this many conversions in an arm and the control together,
	// likewise.
	minConversions = 10
	// The false-winner risk overall, shared between the comparisons and
	// every look at the results.
	familyAlpha = 0.05
	// mixtureVariance is tau^2 per effective person: the boundary is
	// narrowest at 1,000 effective people, about 2,000 in each of two arms.
	mixtureVariance = 8.19 / 1000
	// powerZ is z(0.8): a difference this much past the bar is found four
	// times in five.
	powerZ = 0.8416
)

// armResult is how one arm did, as the API sends it.
type armResult struct {
	VariantID      string  `json:"variantId"`
	Exposures      int64   `json:"exposures"`
	Conversions    int64   `json:"conversions"`
	ConversionRate float64 `json:"conversionRate"`
	Revenue        int64   `json:"revenue"`
	Currency       string  `json:"currency"`
}

type results struct {
	PrimaryMetricEventName string      `json:"primaryMetricEventName"`
	Variants               []armResult `json:"variants"`
}

func (r results) of(armID string) (armResult, bool) {
	for _, one := range r.Variants {
		if one.VariantID == armID {
			return one, true
		}
	}
	return armResult{}, false
}

// significanceLevel is the level each of comparisons arm-versus-control
// tests must reach: Bonferroni's correction keeps the chance of any false
// winner at 5%.
func significanceLevel(comparisons int) float64 {
	return familyAlpha / float64(max(1, comparisons))
}

// evidenceBar is how far from zero, in standard errors, a difference must
// be at information effective people for the sequential test at alpha to
// call it.
func evidenceBar(information, alpha float64) float64 {
	r := mixtureVariance * information
	return math.Sqrt((1 + 1/r) * (math.Log(1+r) - 2*math.Log(alpha)))
}

// alwaysValidPValue is 1 over the mixture likelihood ratio of z at
// information effective people, at most 1.
func alwaysValidPValue(z, information float64) float64 {
	r := mixtureVariance * information
	return math.Min(1, math.Sqrt(1+r)*math.Exp(-r/(1+r)*z*z/2))
}

// reading is what the numbers support for one arm against the control.
type reading struct {
	// verdict is no_data (the arm or the control was shown to nobody),
	// too_early (too few end users or conversions to tell), winner or loser
	// (the arm converts better or worse, significantly), or no_difference.
	verdict string
	// pValue is the always-valid p-value of the difference in conversion
	// rate: valid however often the results are read.
	pValue float64
	// detectableDifference is the smallest difference in rate (0 to 1) that
	// would most likely (four times in five) have shown by now.
	detectableDifference float64
}

// compareArmToControl is the verdict on an arm against the control: the
// sequential test at alpha, and nothing claimed before there are enough end
// users and conversions to tell.
func compareArmToControl(arm, control armResult, alpha float64) reading {
	if arm.Exposures == 0 || control.Exposures == 0 {
		return reading{verdict: "no_data"}
	}
	if arm.Exposures < minExposures || control.Exposures < minExposures || arm.Conversions+control.Conversions < minConversions {
		return reading{verdict: "too_early"}
	}
	armShown, controlShown := float64(arm.Exposures), float64(control.Exposures)
	pooled := float64(arm.Conversions+control.Conversions) / (armShown + controlShown)
	spread := math.Sqrt(pooled * (1 - pooled) * (1/armShown + 1/controlShown))
	difference := float64(arm.Conversions)/armShown - float64(control.Conversions)/controlShown
	information := armShown * controlShown / (armShown + controlShown)
	pValue := 1.0
	if spread != 0 {
		pValue = alwaysValidPValue(difference/spread, information)
	}
	read := reading{verdict: "no_difference", pValue: pValue, detectableDifference: (evidenceBar(information, alpha) + powerZ) * spread}
	switch {
	case pValue >= alpha:
	case difference > 0:
		read.verdict = "winner"
	default:
		read.verdict = "loser"
	}
	return read
}

// twoDigits is a p-value to two significant digits: "0.012", "0.50",
// "1.2e-7".
func twoDigits(value float64) string {
	mantissa, exponent, _ := strings.Cut(strconv.FormatFloat(value, 'e', 1, 64), "e")
	power, _ := strconv.Atoi(exponent)
	if power < -6 || power >= 2 {
		return fmt.Sprintf("%se%+d", mantissa, power)
	}
	return strconv.FormatFloat(value, 'f', 1-power, 64)
}

func rate(value float64) string {
	return strconv.FormatFloat(value*100, 'f', 1, 64) + "%"
}

// verdictLines reads each arm against the control, in sentences.
func verdictLines(found experiment, arms []arm, measured results) []string {
	if found.Status == "draft" {
		return []string{"It has not started, so there are no results yet."}
	}
	var control *arm
	var others []arm
	for index, one := range arms {
		if one.IsControl && control == nil {
			control = &arms[index]
		} else if !one.IsControl {
			others = append(others, one)
		}
	}
	if control == nil {
		return nil
	}
	base, _ := measured.of(control.ID)
	alpha := significanceLevel(len(others))
	var lines []string
	for _, one := range others {
		result, _ := measured.of(one.ID)
		versus := rate(result.ConversionRate) + " vs " + rate(base.ConversionRate)
		read := compareArmToControl(result, base, alpha)
		switch read.verdict {
		case "no_data":
			lines = append(lines, fmt.Sprintf("%s: nobody has been shown it, or the control, yet.", one.Name))
		case "too_early":
			lines = append(lines, fmt.Sprintf("%s: too early to tell (%s); any difference now is likely noise.", one.Name, versus))
		case "no_difference":
			lines = append(lines, fmt.Sprintf("%s: no clear difference from %s yet (%s, p = %s); a difference of about %s points or more would most likely have shown by now.",
				one.Name, control.Name, versus, twoDigits(read.pValue), strconv.FormatFloat(read.detectableDifference*100, 'f', 1, 64)))
		default:
			direction := "worse"
			if read.verdict == "winner" {
				direction = "better"
			}
			lines = append(lines, fmt.Sprintf("%s converts %s than %s (%s, p = %s), which holds however often the results are checked.", one.Name, direction, control.Name, versus, twoDigits(read.pValue)))
		}
	}
	return append(lines, "Revenue is as measured, without a significance test.")
}
