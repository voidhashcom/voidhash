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

const (
	// Below this many exposed end users in an arm (or the control), a
	// comparison says nothing yet.
	minExposures = 100
	// Below this many conversions in an arm and the control together,
	// likewise.
	minConversions = 10
	// The false-winner risk overall, shared between the comparisons.
	familyAlpha = 0.05
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

// normalCDF is the standard normal distribution function (Abramowitz and
// Stegun 7.1.26, error below 1.5e-7).
func normalCDF(x float64) float64 {
	t := 1 / (1 + 0.3275911*(math.Abs(x)/math.Sqrt2))
	erf := 1 - ((((1.061405429*t-1.453152027)*t+1.421413741)*t-0.284496736)*t+0.254829592)*t*math.Exp(-(x*x)/2)
	if x >= 0 {
		return (1 + erf) / 2
	}
	return (1 - erf) / 2
}

// reading is what the numbers support for one arm against the control.
type reading struct {
	// verdict is no_data (the arm or the control was shown to nobody),
	// too_early (too few end users or conversions to tell), winner or loser
	// (the arm converts better or worse, significantly), or no_difference.
	verdict string
	// pValue is the two-sided p-value of the difference in conversion rate.
	pValue float64
	// detectableDifference is the smallest difference in rate (0 to 1) this
	// sample could show at 80% power and 5% significance.
	detectableDifference float64
}

// compareArmToControl is the verdict on an arm against the control: a
// two-sided, pooled two-proportion z-test at alpha, and nothing claimed
// before there are enough end users and conversions to tell.
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
	pValue := 1.0
	if spread != 0 {
		pValue = 2 * (1 - normalCDF(math.Abs(difference/spread)))
	}
	// z(1 - 0.05 / 2) + z(0.8) ≈ 1.96 + 0.84: the difference 80% power detects at 5%.
	read := reading{verdict: "no_difference", pValue: pValue, detectableDifference: 2.8 * spread}
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
			lines = append(lines, fmt.Sprintf("%s: no clear difference from %s (%s, p = %s); only a difference of about %s points would show at this size.",
				one.Name, control.Name, versus, twoDigits(read.pValue), strconv.FormatFloat(read.detectableDifference*100, 'f', 1, 64)))
		default:
			direction := "worse"
			if read.verdict == "winner" {
				direction = "better"
			}
			lines = append(lines, fmt.Sprintf("%s converts %s than %s (%s, p = %s), unlikely to be chance.", one.Name, direction, control.Name, versus, twoDigits(read.pValue)))
		}
	}
	return append(lines, "Revenue is as measured, without a significance test.")
}
