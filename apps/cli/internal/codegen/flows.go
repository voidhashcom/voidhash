package codegen

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
)

// The types a value exchanged with a flow can have.
const (
	flowString  = "string"
	flowNumber  = "number"
	flowBoolean = "boolean"
	// flowList is an ordered list of strings without repeats.
	flowList = "list"
)

// FlowField is a named value of a location's interface.
type FlowField struct {
	Name string
	// Type is "string", "number", "boolean" or "list".
	Type string
	// Default is what an app reads when a flow never set an output, or what
	// a flow holds when the app passes no value for an input (a []any of
	// strings for a list); nil for an argument or reply field, and for an
	// input whose location declares no default.
	Default any
}

// FlowAction is a function of the app a flow may call.
type FlowAction struct {
	Name  string
	Args  []FlowField
	Reply []FlowField
}

// Flow is what an app exchanges with the flow shown at one location, at the
// revision of the location's interface it was read at. The generated types
// carry that revision, and the SDK reports it when it asks what to show, so
// an app is only ever served a flow its code can answer.
type Flow struct {
	// Slug is the location's slug.
	Slug     string
	Revision int
	Inputs   []FlowField
	Outputs  []FlowField
	// Outcomes are the location's own; every flow can also end as
	// completed, purchased, restored or dismissed.
	Outcomes []string
	Actions  []FlowAction
}

// builtInOutcomes are how any flow can end, whatever its location declares.
var builtInOutcomes = []string{"completed", "purchased", "restored", "dismissed"}

// withInterface keeps the locations whose interface was ever set, ordered as
// the slugs are. A location still at revision 0 exchanges nothing, and an
// app presents it by its slug alone.
func withInterface(flows []Flow) []Flow {
	kept := make([]Flow, 0, len(flows))
	for _, flow := range flows {
		if flow.Revision > 0 {
			kept = append(kept, flow)
		}
	}
	order := map[string]int{}
	slugs := make([]string, len(kept))
	for index, flow := range kept {
		slugs[index] = flow.Slug
	}
	for index, slug := range ordered(slugs) {
		order[slug] = index
	}
	slices.SortStableFunc(kept, func(a, b Flow) int { return order[a.Slug] - order[b.Slug] })
	return kept
}

// ownOutcomes are a flow's outcomes without the ones every flow has, which
// each emitter lists itself.
func ownOutcomes(flow Flow) []string {
	var own []string
	for _, outcome := range flow.Outcomes {
		if !slices.Contains(builtInOutcomes, outcome) {
			own = append(own, outcome)
		}
	}
	return own
}

func upperCamel(parts []string) string {
	name := lowerCamel(parts)
	if name == "" {
		return name
	}
	return strings.ToUpper(name[:1]) + name[1:]
}

// flowTypeNames names each flow's namespace: OnboardingFlow for the
// location "onboarding".
func flowTypeNames(flows []Flow, reserved map[string]bool) []string {
	slugs := make([]string, len(flows))
	for index, flow := range flows {
		slugs[index] = flow.Slug
	}
	names := identifiers(slugs, upperCamel, "Location", "", reserved)
	for index := range names {
		names[index] += "Flow"
	}
	return names
}

// --- TypeScript -----------------------------------------------------------

func tsType(kind string) string {
	switch kind {
	case flowBoolean:
		return "boolean"
	case flowList:
		return "string[]"
	default:
		return kind
	}
}

// listDefault is the strings of a list output's default, in order.
func listDefault(value any) []string {
	items, _ := value.([]any)
	strings := make([]string, 0, len(items))
	for _, item := range items {
		if text, ok := item.(string); ok {
			strings = append(strings, text)
		}
	}
	return strings
}

func tsFields(fields []FlowField, optional bool) string {
	if len(fields) == 0 {
		// An object type with no keys; `{}` would accept any value.
		return "Record<never, never>"
	}
	parts := make([]string, len(fields))
	for index, field := range fields {
		mark := ""
		if optional {
			mark = "?"
		}
		parts[index] = field.Name + mark + ": " + tsType(field.Type)
	}
	return "{ " + strings.Join(parts, "; ") + " }"
}

// tsFlows is the `flows` member of VoidhashRegister: per location, what the
// app passes, reads back and handles. Empty without any flow, so a project
// that uses none gets the file it always got.
func tsFlows(flows []Flow) []string {
	if len(flows) == 0 {
		return nil
	}
	lines := []string{"    flows: {"}
	for _, flow := range flows {
		reply := func(action FlowAction) string {
			if len(action.Reply) == 0 {
				return "void"
			}
			return tsFields(action.Reply, false)
		}
		// `completed` is every flow's default ending; the SDK adds the ones a
		// purchase, a restore and a close end a flow with.
		outcomes := union(append([]string{"completed"}, ownOutcomes(flow)...))
		lines = append(lines,
			"      "+jsStringLiteral(flow.Slug)+": {",
			"        input: "+tsFields(flow.Inputs, true)+";",
			"        output: "+tsFields(flow.Outputs, false)+";",
			"        outcome: "+outcomes+";",
		)
		if len(flow.Actions) == 0 {
			lines = append(lines, "        actions: Record<never, never>;")
		} else {
			lines = append(lines, "        actions: {")
			for _, action := range flow.Actions {
				lines = append(lines, fmt.Sprintf("          %s: (args: %s) => Promise<%s> | %s;",
					action.Name, tsFields(action.Args, false), reply(action), reply(action)))
			}
			lines = append(lines, "        };")
		}
		lines = append(lines, "      };")
	}
	return append(lines, "    };")
}

// tsRevisions is the file beside the declarations that holds what a
// declaration file cannot: the revision of each location's interface, as a
// value the app passes to the SDK once.
func tsRevisions(flows []Flow, options Options, file string) string {
	lines := []string{"// " + file + " — generated by voidhash, do not edit"}
	lines = append(lines, markers(options)...)
	lines = append(lines,
		"//",
		"// The revision of each location's interface the types beside this file were generated",
		"// from. Pass it to the Voidhash client as `flowRevisions`, so the app is only shown",
		"// flows its code can answer.",
		"",
		"export const flowRevisions = {",
	)
	for _, flow := range flows {
		lines = append(lines, "  "+jsStringLiteral(flow.Slug)+": "+strconv.Itoa(flow.Revision)+",")
	}
	lines = append(lines, "} as const;", "")
	return strings.Join(lines, "\n")
}

// --- Swift ------------------------------------------------------------------

func swiftType(kind string) string {
	switch kind {
	case flowNumber:
		return "Double"
	case flowBoolean:
		return "Bool"
	case flowList:
		return "[String]"
	default:
		return "String"
	}
}

func swiftCase(kind string) string {
	switch kind {
	case flowNumber:
		return "number"
	case flowBoolean:
		return "bool"
	case flowList:
		return "list"
	default:
		return "string"
	}
}

func swiftZero(kind string) string {
	switch kind {
	case flowNumber:
		return "0"
	case flowBoolean:
		return "false"
	case flowList:
		return "[]"
	default:
		return `""`
	}
}

func swiftLiteral(field FlowField) string {
	switch value := field.Default.(type) {
	case []any:
		var items []string
		for _, item := range listDefault(value) {
			items = append(items, quoted(item, false, func(char rune) string { return fmt.Sprintf(`\u{%X}`, char) }))
		}
		return "[" + strings.Join(items, ", ") + "]"
	case string:
		return quoted(value, false, func(char rune) string { return fmt.Sprintf(`\u{%X}`, char) })
	case float64:
		return strconv.FormatFloat(value, 'g', -1, 64)
	case bool:
		return strconv.FormatBool(value)
	default:
		return swiftZero(field.Type)
	}
}

func swiftName(name string) string {
	if swiftReserved[name] {
		return "`" + name + "`"
	}
	return name
}

func swiftFlows(flows []Flow) []string {
	if len(flows) == 0 {
		return nil
	}
	var lines []string
	names := flowTypeNames(flows, swiftReserved)
	for index, flow := range flows {
		lines = append(lines, swiftFlow(names[index], flow)...)
	}
	return lines
}

func swiftFlow(name string, flow Flow) []string {
	slug := quoted(flow.Slug, false, func(char rune) string { return fmt.Sprintf(`\u{%X}`, char) })
	lines := []string{
		"",
		"/// What the app exchanges with the flow shown at the location " + flow.Slug + ".",
		"///",
		"///     let result = try await voidhash.presentFlow(" + name + ".location, input: .init(), actions: …)",
		"public enum " + name + " {",
		"    /// The location, at the revision of its interface these types were generated from.",
		"    public static let location = FlowLocation<Input, Output, Outcome, Actions>(",
		"        slug: " + slug + ", revision: " + strconv.Itoa(flow.Revision) + ")",
	}

	// Input: every value is optional, because the flow has a default for each.
	if len(flow.Inputs) == 0 {
		lines = append(lines, "", "    public typealias Input = NoFlowInput")
	} else {
		lines = append(lines, "", "    /// What the app passes; a value left out keeps the flow's default.", "    public struct Input: FlowInput {")
		var parameters, assignments, values []string
		for _, field := range flow.Inputs {
			id := swiftName(field.Name)
			if field.Default != nil {
				lines = append(lines, "        /// Left out, the flow starts with "+swiftLiteral(field)+".")
			}
			lines = append(lines, "        public var "+id+": "+swiftType(field.Type)+"?")
			parameters = append(parameters, id+": "+swiftType(field.Type)+"? = nil")
			assignments = append(assignments, "            self."+id+" = "+id)
			values = append(values, fmt.Sprintf("            if let %s { values[%q] = .%s(%s) }", id, field.Name, swiftCase(field.Type), id))
		}
		lines = append(lines, "", "        public init("+strings.Join(parameters, ", ")+") {")
		lines = append(lines, assignments...)
		lines = append(lines, "        }", "", "        public var flowValues: [String: FlowValue] {", "            var values: [String: FlowValue] = [:]")
		lines = append(lines, values...)
		lines = append(lines, "            return values", "        }", "    }")
	}

	// Output: a value the flow did not report reads as the location's default.
	if len(flow.Outputs) == 0 {
		lines = append(lines, "", "    public typealias Output = NoFlowOutput")
	} else {
		lines = append(lines, "", "    /// What the app reads back, however the flow ended.", "    public struct Output: FlowOutput, Equatable {")
		for _, field := range flow.Outputs {
			lines = append(lines, "        public var "+swiftName(field.Name)+": "+swiftType(field.Type))
		}
		lines = append(lines, "", "        public init(flowValues: [String: FlowValue]) {")
		for _, field := range flow.Outputs {
			lines = append(lines, fmt.Sprintf("            self.%s = flowValues[%q]?.%sValue ?? %s",
				swiftName(field.Name), field.Name, swiftCase(field.Type), swiftLiteral(field)))
		}
		lines = append(lines, "        }", "    }")
	}

	lines = append(lines, "", "    /// How the flow ended.", "    public enum Outcome: FlowOutcome, Equatable {")
	outcomes := append([]string{"completed"}, ownOutcomes(flow)...)
	for _, outcome := range append(slices.Clone(outcomes), "purchased", "restored", "dismissed") {
		lines = append(lines, "        case "+swiftName(outcome))
	}
	lines = append(lines,
		"        /// An outcome added to the location after this code was generated.",
		"        case unknown(String)",
		"",
		"        public init(flowOutcome: String) {",
		"            switch flowOutcome {",
	)
	for _, outcome := range outcomes {
		lines = append(lines, fmt.Sprintf("            case %q: self = .%s", outcome, swiftName(outcome)))
	}
	lines = append(lines,
		"            case FlowResult.purchased: self = .purchased",
		"            case FlowResult.restored: self = .restored",
		"            case FlowResult.dismissed: self = .dismissed",
		"            default: self = .unknown(flowOutcome)",
		"            }",
		"        }",
		"    }",
	)

	if len(flow.Actions) == 0 {
		lines = append(lines, "", "    public typealias Actions = NoFlowActions")
	} else {
		var replies, members, parameters, assignments, handlers []string
		for _, action := range flow.Actions {
			result := "Void"
			if len(action.Reply) == 1 {
				result = swiftType(action.Reply[0].Type)
			} else if len(action.Reply) > 1 {
				result = upperCamel(words(action.Name)) + "Reply"
				replies = append(replies, "", "    /// What the app answers to "+action.Name+".", "    public struct "+result+": Sendable {")
				var fields []string
				for _, field := range action.Reply {
					replies = append(replies, "        public var "+swiftName(field.Name)+": "+swiftType(field.Type))
					fields = append(fields, swiftName(field.Name)+": "+swiftType(field.Type))
				}
				replies = append(replies, "", "        public init("+strings.Join(fields, ", ")+") {")
				for _, field := range action.Reply {
					replies = append(replies, "            self."+swiftName(field.Name)+" = "+swiftName(field.Name))
				}
				replies = append(replies, "        }", "    }")
			}
			var signature, passed []string
			for _, arg := range action.Args {
				signature = append(signature, "_ "+swiftName(arg.Name)+": "+swiftType(arg.Type))
				passed = append(passed, fmt.Sprintf("arguments[%q]?.%sValue ?? %s", arg.Name, swiftCase(arg.Type), swiftZero(arg.Type)))
			}
			closure := "@Sendable (" + strings.Join(signature, ", ") + ") async throws -> " + result
			id := swiftName(action.Name)
			members = append(members, "        public var "+id+": "+closure)
			parameters = append(parameters, id+": @escaping "+closure)
			assignments = append(assignments, "            self."+id+" = "+id)
			call := "try await " + id + "(" + strings.Join(passed, ", ") + ")"
			handler := []string{fmt.Sprintf("                %q: { arguments in", action.Name)}
			switch len(action.Reply) {
			case 0:
				if len(action.Args) == 0 {
					handler[0] = fmt.Sprintf("                %q: { _ in", action.Name)
				}
				handler = append(handler, "                    "+call, "                    return [:]")
			case 1:
				if len(action.Args) == 0 {
					handler[0] = fmt.Sprintf("                %q: { _ in", action.Name)
				}
				handler = append(handler, "                    let reply = "+call,
					fmt.Sprintf("                    return [%q: .%s(reply)]", action.Reply[0].Name, swiftCase(action.Reply[0].Type)))
			default:
				if len(action.Args) == 0 {
					handler[0] = fmt.Sprintf("                %q: { _ in", action.Name)
				}
				var pairs []string
				for _, field := range action.Reply {
					pairs = append(pairs, fmt.Sprintf("%q: .%s(reply.%s)", field.Name, swiftCase(field.Type), swiftName(field.Name)))
				}
				handler = append(handler, "                    let reply = "+call, "                    return ["+strings.Join(pairs, ", ")+"]")
			}
			handlers = append(handlers, append(handler, "                },")...)
		}
		lines = append(lines, replies...)
		lines = append(lines, "", "    /// The app's functions the flow may call; a missing one would not compile.", "    public struct Actions: FlowActions {")
		lines = append(lines, members...)
		lines = append(lines, "", "        public init("+strings.Join(parameters, ", ")+") {")
		lines = append(lines, assignments...)
		lines = append(lines, "        }", "", "        public var flowHandlers: [String: FlowActionHandler] {", "            return [")
		lines = append(lines, handlers...)
		lines = append(lines, "            ]", "        }", "    }")
	}
	return append(lines, "}")
}

// --- Kotlin -----------------------------------------------------------------

func kotlinType(kind string) string {
	switch kind {
	case flowNumber:
		return "Double"
	case flowBoolean:
		return "Boolean"
	case flowList:
		return "List<String>"
	default:
		return "String"
	}
}

func kotlinZero(kind string) string {
	switch kind {
	case flowNumber:
		return "0.0"
	case flowBoolean:
		return "false"
	case flowList:
		return "emptyList()"
	default:
		return `""`
	}
}

func kotlinLiteral(field FlowField) string {
	switch value := field.Default.(type) {
	case []any:
		var items []string
		for _, item := range listDefault(value) {
			items = append(items, quoted(item, true, func(char rune) string { return fmt.Sprintf(`\u%04X`, char) }))
		}
		if len(items) == 0 {
			return kotlinZero(flowList)
		}
		return "listOf(" + strings.Join(items, ", ") + ")"
	case string:
		return quoted(value, true, func(char rune) string { return fmt.Sprintf(`\u%04X`, char) })
	case float64:
		text := strconv.FormatFloat(value, 'g', -1, 64)
		if !strings.ContainsAny(text, ".eE") {
			text += ".0"
		}
		return text
	case bool:
		return strconv.FormatBool(value)
	default:
		return kotlinZero(field.Type)
	}
}

// kotlinRead is how a value of kind is read out of what the SDK hands over.
func kotlinRead(source, name, kind, fallback string) string {
	switch kind {
	case flowNumber:
		return fmt.Sprintf("(%s[%q] as? Number)?.toDouble() ?: %s", source, name, fallback)
	case flowBoolean:
		return fmt.Sprintf("%s[%q] as? Boolean ?: %s", source, name, fallback)
	case flowList:
		return fmt.Sprintf("(%s[%q] as? List<*>)?.filterIsInstance<String>() ?: %s", source, name, fallback)
	default:
		return fmt.Sprintf("%s[%q] as? String ?: %s", source, name, fallback)
	}
}

var kotlinReserved = reservedSet(
	"as", "break", "class", "continue", "do", "else", "false", "for", "fun", "if", "in", "interface",
	"is", "null", "object", "package", "return", "super", "this", "throw", "true", "try", "typealias",
	"typeof", "val", "var", "when", "while",
)

func kotlinName(name string) string {
	if kotlinReserved[name] {
		return "`" + name + "`"
	}
	return name
}

func kotlinFlows(flows []Flow) []string {
	if len(flows) == 0 {
		return nil
	}
	var lines []string
	names := flowTypeNames(flows, kotlinReserved)
	for index, flow := range flows {
		lines = append(lines, kotlinFlow(names[index], flow)...)
	}
	return lines
}

func kotlinFlow(name string, flow Flow) []string {
	slug := quoted(flow.Slug, true, func(char rune) string { return fmt.Sprintf(`\u%04X`, char) })
	lines := []string{
		"",
		"/**",
		" * What the app exchanges with the flow shown at the location " + flow.Slug + ":",
		" * `voidhash.presentFlow(activity, " + name + ".location, " + name + ".Input(), actions)`.",
		" */",
		"object " + name + " {",
	}

	input := "NoFlowInput"
	if len(flow.Inputs) > 0 {
		input = "Input"
		lines = append(lines, "    /** What the app passes; a value left out keeps the flow's default. */", "    data class Input(")
		var puts []string
		for _, field := range flow.Inputs {
			if field.Default != nil {
				lines = append(lines, "        /** Left out, the flow starts with "+kotlinLiteral(field)+". */")
			}
			lines = append(lines, "        val "+kotlinName(field.Name)+": "+kotlinType(field.Type)+"? = null,")
			puts = append(puts, fmt.Sprintf("            %s?.let { put(%q, it) }", kotlinName(field.Name), field.Name))
		}
		lines = append(lines, "    ) : FlowInput {", "        override fun toFlowValues(): Map<String, Any> = buildMap {")
		lines = append(lines, puts...)
		lines = append(lines, "        }", "    }", "")
	}

	output, outputOf := "Unit", "{ }"
	if len(flow.Outputs) > 0 {
		output, outputOf = "Output", "Output::from"
		lines = append(lines, "    /** What the app reads back, however the flow ended. */", "    data class Output(")
		for _, field := range flow.Outputs {
			lines = append(lines, "        val "+kotlinName(field.Name)+": "+kotlinType(field.Type)+",")
		}
		lines = append(lines, "    ) {", "        companion object {",
			"            /** An output the flow did not report reads as the location's default. */",
			"            fun from(values: Map<String, Any>) = Output(")
		for _, field := range flow.Outputs {
			lines = append(lines, "                "+kotlinName(field.Name)+" = "+kotlinRead("values", field.Name, field.Type, kotlinLiteral(field))+",")
		}
		lines = append(lines, "            )", "        }", "    }", "")
	}

	lines = append(lines, "    /** How the flow ended. */", "    sealed interface Outcome {")
	outcomes := append([]string{"completed"}, ownOutcomes(flow)...)
	for _, outcome := range append(slices.Clone(outcomes), "purchased", "restored", "dismissed") {
		lines = append(lines, "        data object "+upperCamel(words(outcome))+" : Outcome")
	}
	lines = append(lines,
		"",
		"        /** An outcome added to the location after this code was generated. */",
		"        data class Unknown(val name: String) : Outcome",
		"",
		"        companion object {",
		"            fun from(name: String): Outcome = when (name) {",
	)
	for _, outcome := range outcomes {
		lines = append(lines, fmt.Sprintf("                %q -> %s", outcome, upperCamel(words(outcome))))
	}
	lines = append(lines,
		"                FlowResult.PURCHASED -> Purchased",
		"                FlowResult.RESTORED -> Restored",
		"                FlowResult.DISMISSED -> Dismissed",
		"                else -> Unknown(name)",
		"            }",
		"        }",
		"    }",
		"",
	)

	actions := "NoFlowActions"
	if len(flow.Actions) > 0 {
		actions = "Actions"
		var replies, methods, handlers []string
		for _, action := range flow.Actions {
			result := ""
			if len(action.Reply) == 1 {
				result = ": " + kotlinType(action.Reply[0].Type)
			} else if len(action.Reply) > 1 {
				typeName := upperCamel(words(action.Name)) + "Reply"
				result = ": " + typeName
				var fields []string
				for _, field := range action.Reply {
					fields = append(fields, "val "+kotlinName(field.Name)+": "+kotlinType(field.Type))
				}
				replies = append(replies, "    /** What the app answers to "+action.Name+". */", "    data class "+typeName+"("+strings.Join(fields, ", ")+")", "")
			}
			var signature, passed []string
			for _, arg := range action.Args {
				signature = append(signature, kotlinName(arg.Name)+": "+kotlinType(arg.Type))
				passed = append(passed, kotlinName(arg.Name)+" = "+kotlinRead("arguments", arg.Name, arg.Type, kotlinZero(arg.Type)))
			}
			methods = append(methods, "        suspend fun "+kotlinName(action.Name)+"("+strings.Join(signature, ", ")+")"+result)
			parameter := "arguments"
			if len(action.Args) == 0 {
				parameter = "_"
			}
			call := kotlinName(action.Name) + "(" + strings.Join(passed, ", ") + ")"
			handler := fmt.Sprintf("            %q to FlowActionHandler { %s ->", action.Name, parameter)
			switch len(action.Reply) {
			case 0:
				handlers = append(handlers, handler, "                "+call, "                emptyMap()", "            },")
			case 1:
				handlers = append(handlers, handler, fmt.Sprintf("                mapOf(%q to %s)", action.Reply[0].Name, call), "            },")
			default:
				var pairs []string
				for _, field := range action.Reply {
					pairs = append(pairs, fmt.Sprintf("%q to reply.%s", field.Name, kotlinName(field.Name)))
				}
				handlers = append(handlers, handler, "                val reply = "+call, "                mapOf("+strings.Join(pairs, ", ")+")", "            },")
			}
		}
		lines = append(lines, replies...)
		lines = append(lines, "    /** The app's functions the flow may call; implement every one. */", "    interface Actions : FlowActions {")
		lines = append(lines, methods...)
		lines = append(lines, "", "        override fun flowHandlers(): Map<String, FlowActionHandler> = mapOf(")
		lines = append(lines, handlers...)
		lines = append(lines, "        )", "    }", "")
	}

	return append(lines,
		"    /** The location, at the revision of its interface these types were generated from. */",
		"    val location = FlowLocation<"+input+", "+output+", Outcome, "+actions+">(",
		"        slug = "+slug+",",
		"        revision = "+strconv.Itoa(flow.Revision)+",",
		"        output = "+outputOf+",",
		"        outcome = Outcome::from,",
		"    )",
		"}",
	)
}
