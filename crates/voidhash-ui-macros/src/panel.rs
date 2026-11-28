//! The `#[panel]` attributes of `voidhash_ui::panel`.
//!
//! It keeps the panel function and generates a `PanelDefinition` constant
//! named after it (`scroll_settings` → `SCROLL_SETTINGS`) that carries the
//! panel's `vhp.panels` entry as JSON, checked at compile time.
//! `export_panels!` lists those constants to build the module.

use proc_macro::TokenStream;
use proc_macro2::Span;
use quote::{format_ident, quote};
use syn::ext::IdentExt;
use syn::parse::{Parse, ParseStream};
use syn::{Error, Ident, ItemFn, Lit, LitStr, Result, Token};

/// The traits a component definition declares.
const TRAITS: &[&str] = &[
    "frame",
    "layout",
    "appearance",
    "fill",
    "border",
    "outline",
    "effects",
    "typography",
    "states",
    "interactions",
    "variables",
    "sharedElement",
];

/// The optional context groups any panel can ask for; see the panel ABI.
const CONTEXT_GROUPS: &[&str] = &["layout", "definition", "bindableVariables", "instance"];

/// The document data a `document`-scope panel can read; see the panel ABI
/// specification.
const DOCUMENT_KEYS: &[&str] = &[
    "sharedElement",
    "localVariables",
    "states",
    "variables",
    "screens",
    "interactions",
    "actionLabels",
    "interactionEditor",
    "actionLogics",
    "screenEvents",
    "component",
    "componentActions",
    "selectionColors",
    "flow",
    "textInput",
    "triggers",
    "ownStates",
    "disabled",
    "mainComponent",
    "componentLayer",
    "componentOutlet",
    "logicLayer",
    "logicTemplate",
    "render",
    "layerTransition",
    "layerAccessibility",
    "textRuns",
];

/// Expands `#[panel]` (`voidhash_ui::panel::standalone::panel`) or, for a
/// component crate's own panel, `voidhash_ui::panel::panel`.
pub(crate) fn attribute(args: TokenStream, item: TokenStream, flavor: Flavor) -> TokenStream {
    let args = match syn::parse::<Args>(args) {
        Ok(args) => args,
        Err(error) => return error.to_compile_error().into(),
    };
    let function = match syn::parse::<ItemFn>(item) {
        Ok(function) => function,
        Err(error) => return error.to_compile_error().into(),
    };
    expand(args, function, flavor)
        .unwrap_or_else(Error::into_compile_error)
        .into()
}

/// Which crate a `#[panel]` expansion names, and what it may declare.
#[derive(Clone, Copy, PartialEq)]
pub(crate) enum Flavor {
    /// `voidhash_ui::panel::standalone::panel`: any requirement and scope.
    Panel,
    /// `voidhash_ui::panel::panel`: a component crate's own panel.
    Component,
}

/// Refuses what a component's own panel cannot declare.
fn check_component_panel(args: &Args) -> Result<()> {
    if let Some(span) = args.any {
        return Err(Error::new(
            span,
            "a component's panel applies to its own component: use `for = \"<the component's id>\"`",
        ));
    }
    if let Some(name) = args.traits.first() {
        return Err(Error::new(
            name.span(),
            "a component's panel applies to its own component: use `for = \"<the component's id>\"`; its instances get the trait sections by declaring traits on `#[component]`",
        ));
    }
    match args.definitions.as_slice() {
        [] => {
            return Err(Error::new(
                Span::call_site(),
                "a component's panel names its component: `#[panel(for = \"<the component's id>\")]`",
            ));
        }
        [_] => {}
        [_, extra, ..] => {
            return Err(Error::new(
                extra.span(),
                "a component's panel applies to exactly one component, its own",
            ));
        }
    }
    if let Some(scope) = &args.scope
        && scope.value() != "instance"
    {
        return Err(Error::new(
            scope.span(),
            "a component's panel has the `instance` scope: it edits the selected instances of its component",
        ));
    }
    if let Some((span, _)) = &args.document {
        return Err(Error::new(
            *span,
            "a component's panel cannot read document data; declare traits on `#[component]` to get the States, Interactions and Variables sections",
        ));
    }
    Ok(())
}

#[derive(Default)]
struct Args {
    id: Option<LitStr>,
    title: Option<LitStr>,
    tab: Option<LitStr>,
    definitions: Vec<LitStr>,
    traits: Vec<LitStr>,
    /// `appliesTo` entries as JSON, in the order the arguments name them.
    requirements: Vec<String>,
    any: Option<Span>,
    order: Option<String>,
    multi_selectable: bool,
    scope: Option<LitStr>,
    style: Vec<LitStr>,
    document: Option<(Span, Vec<LitStr>)>,
    context: Vec<LitStr>,
}

impl Parse for Args {
    fn parse(input: ParseStream) -> Result<Self> {
        let mut args = Args::default();
        while !input.is_empty() {
            let key = input.call(Ident::parse_any)?;
            match key.to_string().as_str() {
                "id" => args.id = Some(assigned(input)?),
                "title" => args.title = Some(assigned(input)?),
                "tab" => {
                    let tab: LitStr = assigned(input)?;
                    if !matches!(tab.value().as_str(), "design" | "interaction") {
                        return Err(Error::new(
                            tab.span(),
                            "tab is \"design\" or \"interaction\"",
                        ));
                    }
                    args.tab = Some(tab);
                }
                "for" => {
                    let definition: LitStr = assigned(input)?;
                    args.requirements.push(format!(
                        "{{\"definition\":{}}}",
                        json_string(&definition.value())
                    ));
                    args.definitions.push(definition);
                }
                "trait" => {
                    let name: LitStr = assigned(input)?;
                    if !TRAITS.contains(&name.value().as_str()) {
                        return Err(Error::new(
                            name.span(),
                            format!("unknown trait; expected one of {}", TRAITS.join(", ")),
                        ));
                    }
                    args.requirements
                        .push(format!("{{\"trait\":{}}}", json_string(&name.value())));
                    args.traits.push(name);
                }
                "any" => args.any = Some(key.span()),
                "order" => {
                    input.parse::<Token![=]>()?;
                    let literal: Lit = input.parse()?;
                    let text = match &literal {
                        Lit::Int(int) => int.base10_digits().to_string(),
                        Lit::Float(float) => float.base10_digits().to_string(),
                        _ => return Err(Error::new(literal.span(), "order is a number")),
                    };
                    args.order = Some(text);
                }
                "multi_selectable" => {
                    args.multi_selectable = if input.peek(Token![=]) {
                        input.parse::<Token![=]>()?;
                        input.parse::<syn::LitBool>()?.value
                    } else {
                        true
                    };
                }
                "scope" => {
                    let scope: LitStr = assigned(input)?;
                    if !matches!(
                        scope.value().as_str(),
                        "instance" | "node-style" | "document"
                    ) {
                        return Err(Error::new(
                            scope.span(),
                            "scope is \"instance\", \"node-style\" or \"document\"",
                        ));
                    }
                    args.scope = Some(scope);
                }
                "style" => {
                    let content;
                    syn::parenthesized!(content in input);
                    let keys = content.parse_terminated(<LitStr as Parse>::parse, Token![,])?;
                    args.style.extend(keys);
                }
                "document" => {
                    let content;
                    syn::parenthesized!(content in input);
                    let keys = content.parse_terminated(<LitStr as Parse>::parse, Token![,])?;
                    for key in &keys {
                        if !DOCUMENT_KEYS.contains(&key.value().as_str()) {
                            return Err(Error::new(
                                key.span(),
                                format!(
                                    "unknown document data; expected one of {}",
                                    DOCUMENT_KEYS.join(", ")
                                ),
                            ));
                        }
                    }
                    args.document = Some((key.span(), keys.into_iter().collect()));
                }
                "context" => {
                    let content;
                    syn::parenthesized!(content in input);
                    let groups = content.parse_terminated(<LitStr as Parse>::parse, Token![,])?;
                    for group in &groups {
                        if !CONTEXT_GROUPS.contains(&group.value().as_str()) {
                            return Err(Error::new(
                                group.span(),
                                format!(
                                    "unknown context group; expected one of {}",
                                    CONTEXT_GROUPS.join(", ")
                                ),
                            ));
                        }
                    }
                    args.context.extend(groups);
                }
                other => {
                    return Err(Error::new(
                        key.span(),
                        format!("unknown panel argument `{other}`"),
                    ));
                }
            }
            if !input.is_empty() {
                input.parse::<Token![,]>()?;
            }
        }
        Ok(args)
    }
}

fn assigned(input: ParseStream) -> Result<LitStr> {
    input.parse::<Token![=]>()?;
    input.parse()
}

fn expand(args: Args, function: ItemFn, flavor: Flavor) -> Result<proc_macro2::TokenStream> {
    if flavor == Flavor::Component {
        check_component_panel(&args)?;
    }
    let name = function.sig.ident.to_string();
    let id = args
        .id
        .as_ref()
        .map_or_else(|| camel_case(&name), LitStr::value);
    let title = args
        .title
        .as_ref()
        .map_or_else(|| id.clone(), LitStr::value);
    let tab = args
        .tab
        .as_ref()
        .map_or("design".to_string(), LitStr::value);

    let applies_to = match (
        args.any,
        args.definitions.is_empty() && args.traits.is_empty(),
    ) {
        (Some(span), false) => {
            return Err(Error::new(
                span,
                "`any` cannot be combined with `for` or `trait`",
            ));
        }
        (Some(_), true) => "\"any\"".to_string(),
        (None, true) => {
            return Err(Error::new(
                function.sig.ident.span(),
                "a panel needs `for = \"<definition>\"`, `trait = \"<trait>\"` or `any`",
            ));
        }
        (None, false) => format!("[{}]", args.requirements.join(",")),
    };

    let scope = match &args.scope {
        Some(scope) => scope.value(),
        None if !args.definitions.is_empty() => "instance".to_string(),
        None => "node-style".to_string(),
    };
    if scope == "instance" && args.definitions.is_empty() {
        let span = args
            .scope
            .as_ref()
            .map_or_else(Span::call_site, LitStr::span);
        return Err(Error::new(
            span,
            "an instance-scope panel names its definition with `for`",
        ));
    }

    // Only document panels carry the key, so other manifests are unchanged.
    let document = match (&args.document, scope.as_str()) {
        (Some((span, _)), scope) if scope != "document" => {
            return Err(Error::new(
                *span,
                "only a `scope = \"document\"` panel reads document data",
            ));
        }
        (keys, "document") => {
            let keys: Vec<String> = keys
                .iter()
                .flat_map(|(_, keys)| keys)
                .map(|key| json_string(&key.value()))
                .collect();
            format!(",\"document\":[{}]", keys.join(","))
        }
        _ => String::new(),
    };

    let style: Vec<String> = args
        .style
        .iter()
        .map(|key| json_string(&key.value()))
        .collect();
    // `context` is optional in the manifest, so panels without it keep the
    // entry they always had.
    let context = if args.context.is_empty() {
        String::new()
    } else {
        let groups: Vec<String> = args
            .context
            .iter()
            .map(|group| json_string(&group.value()))
            .collect();
        format!(",\"context\":[{}]", groups.join(","))
    };
    let manifest = format!(
        "{{\"id\":{},\"title\":{},\"tab\":{},\"appliesTo\":{},\"order\":{},\"multiSelectable\":{},\"scope\":{},\"style\":[{}]{}{}}}",
        json_string(&id),
        json_string(&title),
        json_string(&tab),
        applies_to,
        args.order.as_deref().unwrap_or("100"),
        args.multi_selectable,
        json_string(&scope),
        style.join(","),
        document,
        context,
    );

    let constant = format_ident!("{}", name.to_uppercase());
    let render = &function.sig.ident;
    let visibility = &function.vis;
    let doc = format!("The `{id}` panel, generated by `#[panel]` from [`{name}`].");
    let krate = quote!(::voidhash_ui::panel);
    Ok(quote! {
        #function

        #[doc = #doc]
        #visibility const #constant: #krate::PanelDefinition = #krate::PanelDefinition {
            id: #id,
            manifest: #manifest,
            render: #render,
        };
    })
}

/// `scroll_view_settings` → `scrollViewSettings`.
fn camel_case(name: &str) -> String {
    let mut out = String::new();
    let mut upper = false;
    for character in name.chars() {
        if character == '_' {
            upper = !out.is_empty();
        } else if upper {
            out.extend(character.to_uppercase());
            upper = false;
        } else {
            out.push(character);
        }
    }
    out
}

fn json_string(text: &str) -> String {
    let mut out = String::from("\"");
    for character in text.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            character if (character as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", character as u32));
            }
            character => out.push(character),
        }
    }
    out.push('"');
    out
}
