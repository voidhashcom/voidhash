//! The `#[component]` and `#[panel]` attributes and the `PropEnum` derive of
//! `voidhash-ui`, which re-exports them; depend on `voidhash-ui`, not on this
//! crate.
//!
//! `#[component]` turns a function `fn Name(cx: Cx, props…) -> View` into a
//! component: it decodes the props (with their defaults), generates the
//! component definition (guest ABI 2) and, depending on the target, the
//! `vh_*` exports of a WebAssembly module or the function table of a native
//! build.

mod panel;

use proc_macro::TokenStream;
use proc_macro2::{Span, TokenStream as TokenStream2, TokenTree};
use quote::{format_ident, quote};
use syn::parse::{Parse, ParseStream};
use syn::punctuated::Punctuated;
use syn::spanned::Spanned;
use syn::{
    Attribute, Data, DeriveInput, Error, Expr, ExprLit, Fields, FnArg, GenericArgument, ItemFn,
    Lit, LitStr, Pat, PathArguments, Result, Token, Type, UnOp,
};

/// Declares a component. See the `voidhash-ui` documentation.
///
/// ```ignore
/// /// Selectable plan list shown above the purchase button.
/// #[component(
///     title = "Plan picker",
///     events(selected(product_id: product)),
///     capabilities(commerce),
///     traits(frame(resize = "width"), appearance, effects),
/// )]
/// pub fn PlanPicker(
///     cx: Cx,
///     plans: Vec<Product>,
///     #[prop(default = "#7c3aed", group = "Style")] accent: Color,
/// ) -> View { … }
/// ```
#[proc_macro_attribute]
pub fn component(args: TokenStream, item: TokenStream) -> TokenStream {
    let args = match syn::parse::<Args>(args) {
        Ok(args) => args,
        Err(error) => return error.to_compile_error().into(),
    };
    let function = match syn::parse::<ItemFn>(item) {
        Ok(function) => function,
        Err(error) => return error.to_compile_error().into(),
    };
    expand(args, function)
        .unwrap_or_else(Error::into_compile_error)
        .into()
}

/// Makes a fieldless enum an `enum` prop: each variant is an option whose
/// value is the variant name in camelCase and whose title is the name as a
/// sentence, unless `#[prop_enum(value = "…", title = "…")]` says otherwise.
/// The first variant, or the one marked `#[default]`, is the default.
#[proc_macro_derive(PropEnum, attributes(prop_enum))]
pub fn prop_enum(item: TokenStream) -> TokenStream {
    let input = match syn::parse::<DeriveInput>(item) {
        Ok(input) => input,
        Err(error) => return error.to_compile_error().into(),
    };
    derive_prop_enum(input)
        .unwrap_or_else(Error::into_compile_error)
        .into()
}

/// Declares a panel of a panel module, such as the designer's built-in
/// sections. Re-exported as `voidhash_ui::panel::standalone::panel`.
#[proc_macro_attribute]
pub fn panel(args: TokenStream, item: TokenStream) -> TokenStream {
    panel::attribute(args, item, panel::Flavor::Panel)
}

/// Declares a component crate's own editor panel:
/// `#[panel(for = "<the component's id>")]`. Re-exported as
/// `voidhash_ui::panel::panel`. The panel always has the `instance` scope,
/// so it reads and writes only the selected instances of its component;
/// `trait`, `any`, another scope and `document` data are refused.
/// `voidhash_ui::export_panels!` checks that `for` names the crate's
/// component.
#[proc_macro_attribute]
pub fn component_panel(args: TokenStream, item: TokenStream) -> TokenStream {
    panel::attribute(args, item, panel::Flavor::Component)
}

// JSON, possibly with parts the compiler fills in ------------------------------

#[derive(Clone, Debug, PartialEq)]
enum Json {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    Obj(Vec<(String, Json)>),
    /// A constant `&str` expression holding JSON (an enum's options).
    Part(String),
}

fn obj(entries: Vec<(&str, Json)>) -> Json {
    Json::Obj(
        entries
            .into_iter()
            .map(|(key, value)| (key.to_owned(), value))
            .collect(),
    )
}

fn string(text: &str) -> Json {
    Json::Str(text.to_owned())
}

impl Json {
    /// Writes the JSON into `parts`: literal text, with each
    /// [`Json::Part`] as its own entry.
    fn write(&self, parts: &mut Vec<Part>) {
        let push = |text: &str, parts: &mut Vec<Part>| match parts.last_mut() {
            Some(Part::Text(last)) => last.push_str(text),
            _ => parts.push(Part::Text(text.to_owned())),
        };
        match self {
            Json::Null => push("null", parts),
            Json::Bool(value) => push(if *value { "true" } else { "false" }, parts),
            Json::Num(number) => push(&number.to_string(), parts),
            Json::Str(text) => {
                let mut out = String::new();
                write_json_string(&mut out, text);
                push(&out, parts);
            }
            Json::Arr(items) => {
                push("[", parts);
                for (index, item) in items.iter().enumerate() {
                    if index > 0 {
                        push(",", parts);
                    }
                    item.write(parts);
                }
                push("]", parts);
            }
            Json::Obj(entries) => {
                push("{", parts);
                for (index, (key, value)) in entries.iter().enumerate() {
                    if index > 0 {
                        push(",", parts);
                    }
                    let mut out = String::new();
                    write_json_string(&mut out, key);
                    out.push(':');
                    push(&out, parts);
                    value.write(parts);
                }
                push("}", parts);
            }
            Json::Part(expression) => parts.push(Part::Code(expression.clone())),
        }
    }

    /// The runtime value encoding (see the guest ABI), used for defaults.
    fn encode(&self, out: &mut Vec<u8>) {
        let length = |out: &mut Vec<u8>, count: usize| {
            out.extend_from_slice(&u32::try_from(count).unwrap_or(u32::MAX).to_le_bytes());
        };
        match self {
            Json::Null | Json::Part(_) => out.push(0),
            Json::Bool(false) => out.push(1),
            Json::Bool(true) => out.push(2),
            Json::Num(number) => {
                out.push(3);
                out.extend_from_slice(&number.to_le_bytes());
            }
            Json::Str(text) => {
                out.push(4);
                length(out, text.len());
                out.extend_from_slice(text.as_bytes());
            }
            Json::Arr(items) => {
                out.push(5);
                length(out, items.len());
                for item in items {
                    item.encode(out);
                }
            }
            Json::Obj(entries) => {
                out.push(6);
                length(out, entries.len());
                for (key, value) in entries {
                    length(out, key.len());
                    out.extend_from_slice(key.as_bytes());
                    value.encode(out);
                }
            }
        }
    }
}

enum Part {
    Text(String),
    Code(String),
}

fn write_json_string(out: &mut String, text: &str) {
    out.push('"');
    for character in text.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

/// Converts a literal (`"text"`, `12`, `-1.5`, `true`, `None`, `[…]` or
/// `vec![…]`) to JSON.
fn json_from_expr(expr: &Expr) -> Result<Json> {
    let unsupported = || {
        Error::new(
            expr.span(),
            "defaults are literals: a string, number, bool, `None`, or an array of them",
        )
    };
    match expr {
        Expr::Lit(ExprLit { lit, .. }) => match lit {
            Lit::Str(text) => Ok(Json::Str(text.value())),
            Lit::Int(int) => Ok(Json::Num(int.base10_parse::<f64>()?)),
            Lit::Float(float) => Ok(Json::Num(float.base10_parse::<f64>()?)),
            Lit::Bool(value) => Ok(Json::Bool(value.value)),
            _ => Err(unsupported()),
        },
        Expr::Unary(unary) if matches!(unary.op, UnOp::Neg(_)) => {
            match json_from_expr(&unary.expr)? {
                Json::Num(number) => Ok(Json::Num(-number)),
                _ => Err(unsupported()),
            }
        }
        Expr::Array(array) => array
            .elems
            .iter()
            .map(json_from_expr)
            .collect::<Result<_>>()
            .map(Json::Arr),
        Expr::Reference(reference) => json_from_expr(&reference.expr),
        Expr::Paren(paren) => json_from_expr(&paren.expr),
        Expr::Group(group) => json_from_expr(&group.expr),
        Expr::Path(path) if path.path.is_ident("None") => Ok(Json::Null),
        Expr::Macro(mac) if mac.mac.path.is_ident("vec") => {
            let items = mac
                .mac
                .parse_body_with(Punctuated::<Expr, Token![,]>::parse_terminated)?;
            items
                .iter()
                .map(json_from_expr)
                .collect::<Result<_>>()
                .map(Json::Arr)
        }
        _ => Err(unsupported()),
    }
}

fn number_literal(expr: &Expr) -> Result<f64> {
    match json_from_expr(expr)? {
        Json::Num(number) => Ok(number),
        _ => Err(Error::new(expr.span(), "expected a number")),
    }
}

// Attribute arguments -------------------------------------------------------------

#[derive(Default)]
struct Args {
    id: Option<LitStr>,
    name: Option<LitStr>,
    version: Option<LitStr>,
    title: Option<LitStr>,
    description: Option<LitStr>,
    icon: Option<LitStr>,
    category: Option<LitStr>,
    keywords: Vec<LitStr>,
    events: Vec<Event>,
    states: Vec<LitStr>,
    capabilities: Vec<syn::Ident>,
    traits: Vec<(String, Json)>,
    /// `slot`: the default slot; `slots(…)`: named slots.
    slots: Option<Vec<String>>,
    children_any: bool,
    fallback: Option<LitStr>,
    width: Option<Json>,
    height: Option<Json>,
    /// The guest ABI the component declares; 2 unless it needs more.
    abi: Option<u32>,
    /// `follows_text_size`: the runtime sizes the component's text for the
    /// end user's text size (`followsTextSize` in its definition).
    follows_text_size: bool,
}

struct Event {
    name: String,
    payload: Vec<(String, String)>,
}

const CAPABILITIES: [&str; 5] = ["commerce", "links", "analytics", "navigation", "haptics"];
const TRAITS: [&str; 11] = [
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

fn parse_list<T>(input: ParseStream, item: impl Fn(ParseStream) -> Result<T>) -> Result<Vec<T>> {
    let content;
    syn::parenthesized!(content in input);
    let mut items = Vec::new();
    while !content.is_empty() {
        items.push(item(&content)?);
        if !content.is_empty() {
            content.parse::<Token![,]>()?;
        }
    }
    Ok(items)
}

impl Parse for Args {
    #[allow(clippy::too_many_lines)] // One arm per argument.
    fn parse(input: ParseStream) -> Result<Self> {
        let mut args = Args::default();
        while !input.is_empty() {
            let key: syn::Ident = input.call(syn::ext::IdentExt::parse_any)?;
            match key.to_string().as_str() {
                "id" => args.id = Some(parse_assigned(input)?),
                "name" => args.name = Some(parse_assigned(input)?),
                "version" => args.version = Some(parse_assigned(input)?),
                "title" => args.title = Some(parse_assigned(input)?),
                "description" => args.description = Some(parse_assigned(input)?),
                "icon" => args.icon = Some(parse_assigned(input)?),
                "category" => args.category = Some(parse_assigned(input)?),
                "fallback" => {
                    let fallback: LitStr = parse_assigned(input)?;
                    if !matches!(
                        fallback.value().as_str(),
                        "hide" | "placeholder" | "children"
                    ) {
                        return Err(Error::new(
                            fallback.span(),
                            "fallback is \"hide\", \"placeholder\" or \"children\"",
                        ));
                    }
                    args.fallback = Some(fallback);
                }
                "keywords" => args.keywords = parse_list(input, |input| input.parse())?,
                "states" => args.states = parse_list(input, |input| input.parse())?,
                "follows_text_size" => args.follows_text_size = true,
                "slot" => {
                    let slot = if input.peek(Token![=]) {
                        input.parse::<Token![=]>()?;
                        input.parse::<syn::LitBool>()?.value
                    } else {
                        true
                    };
                    args.slots = Some(if slot {
                        vec!["default".to_owned()]
                    } else {
                        Vec::new()
                    });
                }
                "slots" => {
                    let names: Vec<LitStr> = parse_list(input, |input| input.parse())?;
                    args.slots = Some(names.iter().map(LitStr::value).collect());
                }
                "children" => {
                    let kind: LitStr = parse_assigned(input)?;
                    match kind.value().as_str() {
                        "any" => args.children_any = true,
                        "none" => args.slots = Some(Vec::new()),
                        _ => {
                            return Err(Error::new(kind.span(), "children is \"any\" or \"none\""));
                        }
                    }
                }
                "events" | "actions" => args.events.extend(parse_list(input, parse_event)?),
                "capabilities" => {
                    for capability in parse_list(input, |input| {
                        input.call(<syn::Ident as syn::ext::IdentExt>::parse_any)
                    })? {
                        if !CAPABILITIES.contains(&capability.to_string().as_str()) {
                            return Err(Error::new(
                                capability.span(),
                                format!("expected one of {}", CAPABILITIES.join(", ")),
                            ));
                        }
                        args.capabilities.push(capability);
                    }
                }
                "traits" => args.traits = parse_list(input, parse_trait)?,
                "abi" => {
                    input.parse::<Token![=]>()?;
                    let abi: syn::LitInt = input.parse()?;
                    match abi.base10_parse::<u32>()? {
                        version @ 2..=4 => args.abi = Some(version),
                        _ => return Err(Error::new(abi.span(), "abi is 2, 3 or 4")),
                    }
                }
                "size" => {
                    let content;
                    syn::parenthesized!(content in input);
                    while !content.is_empty() {
                        let axis: syn::Ident = content.parse()?;
                        content.parse::<Token![=]>()?;
                        let value: Expr = content.parse()?;
                        let json = match json_from_expr(&value)? {
                            Json::Str(text) if text == "fill" || text == "hug" => Json::Str(text),
                            Json::Num(number) if number > 0.0 => Json::Num(number),
                            _ => {
                                return Err(Error::new(
                                    value.span(),
                                    "size is \"fill\", \"hug\" or a positive number",
                                ));
                            }
                        };
                        match axis.to_string().as_str() {
                            "width" => args.width = Some(json),
                            "height" => args.height = Some(json),
                            _ => return Err(Error::new(axis.span(), "expected width or height")),
                        }
                        if !content.is_empty() {
                            content.parse::<Token![,]>()?;
                        }
                    }
                }
                _ => {
                    return Err(Error::new(
                        key.span(),
                        "expected id, name, version, title, description, icon, category, keywords, \
                         events, states, capabilities, traits, slot, slots, children, size, fallback or abi \
                         (a component declares its editor panel with `voidhash_ui::export_panels!`)",
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

fn parse_assigned(input: ParseStream) -> Result<LitStr> {
    input.parse::<Token![=]>()?;
    input.parse()
}

/// `frame(resize = "both", aspect = "free")` or a plain trait name.
fn parse_trait(input: ParseStream) -> Result<(String, Json)> {
    let name: syn::Ident = input.call(syn::ext::IdentExt::parse_any)?;
    let text = name.to_string();
    if text == "frame" {
        let mut frame = vec![("resize".to_owned(), string("both"))];
        if input.peek(syn::token::Paren) {
            let content;
            syn::parenthesized!(content in input);
            while !content.is_empty() {
                let key: syn::Ident = content.parse()?;
                let value: LitStr = parse_assigned(&content)?;
                let allowed: &[&str] = match key.to_string().as_str() {
                    "resize" => &["both", "width", "height", "none"],
                    "aspect" => &["free", "intrinsic"],
                    _ => return Err(Error::new(key.span(), "expected resize or aspect")),
                };
                if !allowed.contains(&value.value().as_str()) {
                    return Err(Error::new(
                        value.span(),
                        format!("expected {}", allowed.join(", ")),
                    ));
                }
                let key = key.to_string();
                frame.retain(|(existing, _)| *existing != key);
                frame.push((key, Json::Str(value.value())));
                if !content.is_empty() {
                    content.parse::<Token![,]>()?;
                }
            }
        }
        return Ok((text, Json::Obj(frame)));
    }
    let camel = camel_case(&text);
    if !TRAITS.contains(&camel.as_str()) {
        return Err(Error::new(
            name.span(),
            format!("expected frame or one of {}", TRAITS.join(", ")),
        ));
    }
    Ok((camel, Json::Obj(Vec::new())))
}

/// `selected(product_id: product, index: number)`, `dismissed` or
/// `"custom-name"(…)`.
fn parse_event(input: ParseStream) -> Result<Event> {
    let name = if input.peek(LitStr) {
        input.parse::<LitStr>()?.value()
    } else {
        camel_case(
            &input
                .call(<syn::Ident as syn::ext::IdentExt>::parse_any)?
                .to_string(),
        )
    };
    let mut payload = Vec::new();
    if input.peek(syn::token::Paren) {
        let content;
        syn::parenthesized!(content in input);
        while !content.is_empty() {
            let field: syn::Ident = content.call(syn::ext::IdentExt::parse_any)?;
            content.parse::<Token![:]>()?;
            let ty: syn::Ident = content.call(syn::ext::IdentExt::parse_any)?;
            let mut ty_name = ty.to_string();
            if content.peek(syn::token::Bracket) {
                let brackets;
                syn::bracketed!(brackets in content);
                if !brackets.is_empty() {
                    return Err(brackets.error("expected `[]`"));
                }
                ty_name.push_str("[]");
            }
            if !matches!(
                ty_name.strip_suffix("[]").unwrap_or(&ty_name),
                "string" | "number" | "boolean" | "color" | "image" | "product"
            ) {
                return Err(Error::new(
                    ty.span(),
                    "expected string, number, boolean, color, image or product (optionally with [])",
                ));
            }
            payload.push((camel_case(&field.to_string()), ty_name));
            if !content.is_empty() {
                content.parse::<Token![,]>()?;
            }
        }
    }
    Ok(Event { name, payload })
}

/// The definition type of a payload field type name.
fn payload_type(name: &str) -> Json {
    if let Some(item) = name.strip_suffix("[]") {
        return obj(vec![("kind", string("list")), ("of", payload_type(item))]);
    }
    match name {
        "image" => obj(vec![
            ("kind", string("asset")),
            ("accepts", Json::Arr(vec![string("image")])),
        ]),
        other => obj(vec![("kind", string(other))]),
    }
}

// Props -----------------------------------------------------------------------------

struct PropSpec {
    ident: syn::Ident,
    ty: Type,
    name: String,
    /// The type's shape: the prop kind of its items, whether it is a list,
    /// whether it may be null, and the enum type for enum props.
    base: String,
    array: bool,
    enum_type: Option<Type>,
    default: Json,
    /// Default given in the attribute, or the type's (`None` for enums,
    /// whose default is their own).
    explicit_default: bool,
    attr: PropAttr,
}

#[derive(Default)]
struct PropAttr {
    default: Option<Expr>,
    name: Option<LitStr>,
    ty: Option<LitStr>,
    title: Option<LitStr>,
    description: Option<LitStr>,
    group: Option<LitStr>,
    min: Option<f64>,
    max: Option<f64>,
    step: Option<f64>,
    unit: Option<LitStr>,
    multiline: bool,
    max_length: Option<f64>,
    max_items: Option<f64>,
    accepts: Vec<LitStr>,
    visible_when: Option<Json>,
    localizable: bool,
    bindable: Option<bool>,
    /// The component writes the prop while the end user acts (guest ABI 4).
    writes: bool,
    /// The component computes the prop and writes it at any time (ABI 4).
    computed: bool,
    /// A content prop's params: name and definition type.
    params: Vec<(String, Json)>,
    /// A component prop's contract: the props it sets and the events it
    /// takes, each with its payload.
    contract_props: Vec<(String, Json)>,
    contract_events: Vec<(String, Vec<(String, Json)>)>,
}

/// Parses `(name: Type, …)`: a content prop's params, or the props or an
/// event's payload of a component prop's contract.
fn parse_fields(input: ParseStream) -> Result<Vec<(String, Json)>> {
    let content;
    syn::parenthesized!(content in input);
    let mut fields = Vec::new();
    while !content.is_empty() {
        let name: syn::Ident = content.parse()?;
        content.parse::<Token![:]>()?;
        let ty: Type = content.parse()?;
        let json = field_type(&ty).ok_or_else(|| {
            Error::new(
                ty.span(),
                "use String, a number, bool, Color, Product, ProductId or Vec<String>",
            )
        })?;
        let name = camel_case(&name.to_string());
        if fields.iter().any(|(existing, _)| *existing == name) {
            return Err(Error::new(Span::call_site(), "a field is named twice"));
        }
        fields.push((name, json));
        if !content.is_empty() {
            content.parse::<Token![,]>()?;
        }
    }
    Ok(fields)
}

/// The definition type of a Rust type a param or contract field has.
fn field_type(ty: &Type) -> Option<Json> {
    let (base, array, nullable, enum_type) = prop_shape(ty)?;
    if nullable || enum_type.is_some() || matches!(base.as_str(), "content" | "component") {
        return None;
    }
    let item = match base.as_str() {
        "image" | "asset" => obj(vec![
            ("kind", string("asset")),
            ("accepts", Json::Arr(vec![string("image")])),
        ]),
        "fill" => return None,
        other => obj(vec![("kind", string(other))]),
    };
    Some(if array {
        obj(vec![("kind", string("list")), ("of", item)])
    } else {
        item
    })
}

fn parse_condition(meta: &syn::meta::ParseNestedMeta<'_>) -> Result<Json> {
    let mut prop = None;
    let mut equals = None;
    let mut one_of = None;
    meta.parse_nested_meta(|inner| {
        if inner.path.is_ident("prop") {
            prop = Some(inner.value()?.parse::<LitStr>()?.value());
        } else if inner.path.is_ident("equals") {
            equals = Some(json_from_expr(&inner.value()?.parse::<Expr>()?)?);
        } else if inner.path.is_ident("one_of") {
            match json_from_expr(&inner.value()?.parse::<Expr>()?)? {
                Json::Arr(values) => one_of = Some(values),
                _ => return Err(inner.error("one_of takes an array")),
            }
        } else {
            return Err(inner.error("expected prop, equals or one_of"));
        }
        Ok(())
    })?;
    let Some(prop) = prop else {
        return Err(meta.error("visible_when needs `prop = \"name\"`"));
    };
    match (equals, one_of) {
        (Some(value), None) => Ok(obj(vec![
            ("kind", string("equals")),
            ("prop", Json::Str(prop)),
            ("value", value),
        ])),
        (None, Some(values)) => Ok(obj(vec![
            ("kind", string("oneOf")),
            ("prop", Json::Str(prop)),
            ("values", Json::Arr(values)),
        ])),
        _ => Err(meta.error("visible_when takes `equals = …` or `one_of = […]`")),
    }
}

/// The component's value, declared by the parameter marked `#[value]`.
struct ValueParam {
    /// `string`, `number` or `boolean`.
    kind: &'static str,
    secret: bool,
    /// Whether the component reports whether the value is valid
    /// (`#[value(validity)]`).
    validity: bool,
    /// The type inside `Input<…>`.
    inner: Type,
}

/// Takes a parameter's `#[value]` attribute, `#[value(secret)]`,
/// `#[value(validity)]` or both: whether it has one, whether the value is
/// secret and whether the component reports its validity.
fn take_value_attr(attrs: &mut Vec<Attribute>) -> Result<Option<(bool, bool)>> {
    let mut found = None;
    let mut error = None;
    attrs.retain(|attr| {
        if !attr.path().is_ident("value") {
            return true;
        }
        let mut secret = false;
        let mut validity = false;
        if !matches!(attr.meta, syn::Meta::Path(_)) {
            let parsed = attr.parse_nested_meta(|meta| {
                if meta.path.is_ident("secret") {
                    secret = true;
                    Ok(())
                } else if meta.path.is_ident("validity") {
                    validity = true;
                    Ok(())
                } else {
                    Err(meta.error("expected `secret` or `validity`"))
                }
            });
            if let Err(parsed) = parsed {
                error = Some(parsed);
            }
        }
        found = Some((secret, validity));
        false
    });
    match error {
        Some(error) => Err(error),
        None => Ok(found),
    }
}

/// The value a parameter of type `Input<String>`, `Input<f64>` or
/// `Input<bool>` declares.
fn value_param(ty: &Type, secret: bool, validity: bool) -> Option<ValueParam> {
    let Type::Path(path) = ty else {
        return None;
    };
    let segment = path.path.segments.last()?;
    if segment.ident != "Input" {
        return None;
    }
    let PathArguments::AngleBracketed(arguments) = &segment.arguments else {
        return None;
    };
    let GenericArgument::Type(inner) = arguments.args.first()? else {
        return None;
    };
    let Type::Path(inner_path) = inner else {
        return None;
    };
    let last = inner_path.path.segments.last()?;
    let kind = match last.ident.to_string().as_str() {
        "String" => "string",
        "f64" => "number",
        "bool" => "boolean",
        "Vec" if holds_strings(&last.arguments) => "list",
        _ => return None,
    };
    Some(ValueParam {
        kind,
        secret,
        validity,
        inner: inner.clone(),
    })
}

/// Whether `Vec`'s arguments are `<String>`: the value of a list.
fn holds_strings(arguments: &PathArguments) -> bool {
    let PathArguments::AngleBracketed(arguments) = arguments else {
        return false;
    };
    matches!(
        arguments.args.first(),
        Some(GenericArgument::Type(Type::Path(item)))
            if item.path.segments.last().is_some_and(|segment| segment.ident == "String")
    )
}

/// Whether the tokens call `text_input(…)`, the element guest ABI 3 added.
fn calls_text_input(tokens: TokenStream2) -> bool {
    let mut previous_is_text_input = false;
    for token in tokens {
        match token {
            TokenTree::Ident(ident) => {
                previous_is_text_input = ident == "text_input";
                continue;
            }
            TokenTree::Group(group) => {
                if previous_is_text_input
                    && group.delimiter() == proc_macro2::Delimiter::Parenthesis
                {
                    return true;
                }
                if calls_text_input(group.stream()) {
                    return true;
                }
            }
            TokenTree::Punct(_) | TokenTree::Literal(_) => {}
        }
        previous_is_text_input = false;
    }
    false
}

fn take_prop_attr(attrs: &mut Vec<Attribute>) -> Result<PropAttr> {
    let mut result = PropAttr::default();
    let mut error = None;
    attrs.retain(|attr| {
        if !attr.path().is_ident("prop") {
            return true;
        }
        let parsed = attr.parse_nested_meta(|meta| {
            let path = meta
                .path
                .get_ident()
                .map(ToString::to_string)
                .unwrap_or_default();
            match path.as_str() {
                "default" => result.default = Some(meta.value()?.parse()?),
                "name" => result.name = Some(meta.value()?.parse()?),
                "type" => result.ty = Some(meta.value()?.parse()?),
                "title" => result.title = Some(meta.value()?.parse()?),
                "description" => result.description = Some(meta.value()?.parse()?),
                "group" => result.group = Some(meta.value()?.parse()?),
                "unit" => {
                    let unit: LitStr = meta.value()?.parse()?;
                    if !matches!(unit.value().as_str(), "px" | "%" | "s" | "deg" | "x") {
                        return Err(Error::new(unit.span(), "unit is px, %, s, deg or x"));
                    }
                    result.unit = Some(unit);
                }
                "min" => result.min = Some(number_literal(&meta.value()?.parse()?)?),
                "max" => result.max = Some(number_literal(&meta.value()?.parse()?)?),
                "step" => result.step = Some(number_literal(&meta.value()?.parse()?)?),
                "max_length" => result.max_length = Some(number_literal(&meta.value()?.parse()?)?),
                "max_items" => result.max_items = Some(number_literal(&meta.value()?.parse()?)?),
                "multiline" => result.multiline = true,
                "localizable" => result.localizable = true,
                "bindable" => {
                    result.bindable = Some(if meta.input.peek(Token![=]) {
                        meta.value()?.parse::<syn::LitBool>()?.value
                    } else {
                        true
                    });
                }
                "accepts" => {
                    meta.parse_nested_meta(|kind| {
                        let name = kind
                            .path
                            .get_ident()
                            .map(ToString::to_string)
                            .unwrap_or_default();
                        // A component prop's contract: `props(…)` and `events(…)`.
                        if name == "props" && kind.input.peek(syn::token::Paren) {
                            result.contract_props = parse_fields(kind.input)?;
                        } else if name == "events" && kind.input.peek(syn::token::Paren) {
                            kind.parse_nested_meta(|event| {
                                let name = event
                                    .path
                                    .get_ident()
                                    .map(ToString::to_string)
                                    .unwrap_or_default();
                                let payload = if event.input.peek(syn::token::Paren) {
                                    parse_fields(event.input)?
                                } else {
                                    Vec::new()
                                };
                                result.contract_events.push((camel_case(&name), payload));
                                Ok(())
                            })?;
                        } else {
                            result.accepts.push(LitStr::new(&name, Span::call_site()));
                        }
                        Ok(())
                    })?;
                }
                "params" => result.params = parse_fields(meta.input)?,
                "writes" => result.writes = true,
                "computed" => result.computed = true,
                "visible_when" => result.visible_when = Some(parse_condition(&meta)?),
                _ => {
                    return Err(meta.error(
                        "expected default, name, type, title, description, group, min, max, step, \
                         unit, multiline, max_length, max_items, accepts, params, visible_when, \
                         localizable, bindable, writes or computed",
                    ));
                }
            }
            Ok(())
        });
        if let Err(parsed) = parsed {
            error = Some(parsed);
        }
        false
    });
    match error {
        Some(error) => Err(error),
        None => Ok(result),
    }
}

/// The shape of a Rust prop type: `(base, array, nullable, enum type)`.
/// A type the binding does not know is an enum deriving `PropEnum`.
fn prop_shape(ty: &Type) -> Option<(String, bool, bool, Option<Type>)> {
    let Type::Path(path) = ty else {
        return None;
    };
    let segment = path.path.segments.last()?;
    let inner = || match &segment.arguments {
        PathArguments::AngleBracketed(arguments) => match arguments.args.first()? {
            GenericArgument::Type(inner) => Some(inner),
            _ => None,
        },
        _ => None,
    };
    let base = match segment.ident.to_string().as_str() {
        "Option" => {
            let (base, array, _, enum_type) = prop_shape(inner()?)?;
            return Some((base, array, true, enum_type));
        }
        "Vec" => {
            let (base, array, nullable, enum_type) = prop_shape(inner()?)?;
            if array || nullable {
                return None;
            }
            return Some((base, true, false, enum_type));
        }
        "String" => "string",
        "f64" | "f32" | "i32" | "i64" | "u32" | "u64" | "usize" => "number",
        "bool" => "boolean",
        "Color" => "color",
        "Image" => "image",
        "Asset" => "asset",
        "Fill" => "fill",
        "Product" | "ProductId" => "product",
        "Content" => "content",
        "ComponentProp" => "component",
        _ => return Some(("enum".to_owned(), false, false, Some(ty.clone()))),
    };
    Some((base.to_owned(), false, false, None))
}

fn default_for(base: &str, array: bool, nullable: bool) -> Json {
    if nullable {
        return Json::Null;
    }
    if array {
        return Json::Arr(Vec::new());
    }
    match base {
        "string" => Json::Str(String::new()),
        "number" => Json::Num(0.0),
        "boolean" => Json::Bool(false),
        "color" => Json::Str("#000000".to_owned()),
        _ => Json::Null,
    }
}

fn check_default(json: &Json, base: &str, array: bool, nullable: bool) -> bool {
    if array {
        return match json {
            Json::Null => nullable,
            Json::Arr(items) => items
                .iter()
                .all(|item| check_default(item, base, false, false)),
            _ => false,
        };
    }
    match (json, base) {
        (Json::Null, "product" | "image" | "asset" | "fill" | "enum") => true,
        (Json::Null, _) => nullable,
        (Json::Str(_), "string" | "image" | "asset" | "product" | "enum" | "fill") => true,
        (Json::Str(text), "color") => is_hex_color(text),
        (Json::Num(_), "number") => true,
        (Json::Bool(_), "boolean") => true,
        _ => false,
    }
}

fn is_hex_color(text: &str) -> bool {
    text.strip_prefix('#').is_some_and(|digits| {
        matches!(digits.len(), 3 | 4 | 6 | 8) && digits.chars().all(|c| c.is_ascii_hexdigit())
    })
}

impl PropSpec {
    /// The definition type of the prop's items.
    fn item_type(&self) -> Json {
        let attr = &self.attr;
        match self.base.as_str() {
            "string" => {
                let mut entries = vec![("kind", string("string"))];
                if attr.multiline {
                    entries.push(("multiline", Json::Bool(true)));
                }
                if let Some(max) = attr.max_length {
                    entries.push(("maxLength", Json::Num(max)));
                }
                obj(entries)
            }
            "number" => {
                let mut entries = vec![("kind", string("number"))];
                for (key, value) in [("min", attr.min), ("max", attr.max), ("step", attr.step)] {
                    if let Some(value) = value {
                        entries.push((key, Json::Num(value)));
                    }
                }
                if let Some(unit) = &attr.unit {
                    entries.push(("unit", Json::Str(unit.value())));
                }
                obj(entries)
            }
            "image" | "asset" => {
                let accepts = if attr.accepts.is_empty() {
                    vec![string("image")]
                } else {
                    attr.accepts
                        .iter()
                        .map(|kind| Json::Str(kind.value()))
                        .collect()
                };
                obj(vec![
                    ("kind", string("asset")),
                    ("accepts", Json::Arr(accepts)),
                ])
            }
            "enum" => {
                let ty = self
                    .enum_type
                    .as_ref()
                    .map_or_else(TokenStream2::new, |ty| quote!(#ty));
                obj(vec![
                    ("kind", string("enum")),
                    (
                        "options",
                        Json::Part(quote!(<#ty as ::voidhash_ui::PropEnum>::OPTIONS).to_string()),
                    ),
                ])
            }
            "content" => obj(vec![
                ("kind", string("content")),
                (
                    "params",
                    Json::Arr(
                        attr.params
                            .iter()
                            .map(|(name, ty)| {
                                obj(vec![
                                    ("name", Json::Str(name.clone())),
                                    ("type", ty.clone()),
                                ])
                            })
                            .collect(),
                    ),
                ),
            ]),
            "component" => {
                let fields = |fields: &[(String, Json)]| {
                    Json::Arr(
                        fields
                            .iter()
                            .map(|(name, ty)| {
                                obj(vec![
                                    ("name", Json::Str(name.clone())),
                                    ("type", ty.clone()),
                                ])
                            })
                            .collect(),
                    )
                };
                let mut entries = vec![
                    ("kind", string("component")),
                    (
                        "accepts",
                        obj(vec![
                            ("props", fields(&attr.contract_props)),
                            (
                                "events",
                                Json::Arr(
                                    attr.contract_events
                                        .iter()
                                        .map(|(name, payload)| {
                                            obj(vec![
                                                ("name", Json::Str(name.clone())),
                                                ("payload", fields(payload)),
                                            ])
                                        })
                                        .collect(),
                                ),
                            ),
                        ]),
                    ),
                ];
                if let Some(Expr::Lit(ExprLit {
                    lit: Lit::Str(default),
                    ..
                })) = &attr.default
                {
                    entries.push(("default", Json::Str(default.value())));
                }
                obj(entries)
            }
            other => obj(vec![("kind", string(other))]),
        }
    }

    /// Whether the prop is content or a component (guest ABI 4), which the
    /// instance fills with its children rather than a value.
    fn slotted(&self) -> bool {
        matches!(self.base.as_str(), "content" | "component")
    }

    fn definition(&self) -> Json {
        let ty = if self.array {
            let mut list = vec![("kind", string("list")), ("of", self.item_type())];
            if let Some(max) = self.attr.max_items {
                list.push(("maxItems", Json::Num(max)));
            }
            obj(list)
        } else {
            self.item_type()
        };
        let default =
            if self.base == "enum" && !self.explicit_default && !self.array && !self.nullable() {
                let ty = self
                    .enum_type
                    .as_ref()
                    .map_or_else(TokenStream2::new, |ty| quote!(#ty));
                Json::Part(quote!(<#ty as ::voidhash_ui::PropEnum>::DEFAULT).to_string())
            } else {
                self.default.clone()
            };
        let mut entries = vec![("name", Json::Str(self.name.clone()))];
        if let Some(title) = &self.attr.title {
            entries.push(("title", Json::Str(title.value())));
        }
        if let Some(description) = &self.attr.description {
            entries.push(("description", Json::Str(description.value())));
        }
        entries.push(("type", ty));
        entries.push(("default", if self.slotted() { Json::Null } else { default }));
        if let Some(group) = &self.attr.group {
            entries.push(("group", Json::Str(group.value())));
        }
        if let Some(condition) = &self.attr.visible_when {
            entries.push(("visibleWhen", condition.clone()));
        }
        if let Some(bindable) = self.attr.bindable {
            entries.push(("bindable", Json::Bool(bindable)));
        }
        if self.attr.localizable {
            entries.push(("localizable", Json::Bool(true)));
        }
        if self.attr.writes {
            entries.push(("writes", Json::Bool(true)));
        }
        if self.attr.computed {
            entries.push(("computed", Json::Bool(true)));
        }
        obj(entries)
    }

    fn nullable(&self) -> bool {
        matches!(&self.ty, Type::Path(path) if path.path.segments.last().is_some_and(|segment| segment.ident == "Option"))
    }
}

// Expansion -------------------------------------------------------------------------

#[allow(clippy::too_many_lines)] // The definition, then the generated items.
fn expand(args: Args, mut function: ItemFn) -> Result<TokenStream2> {
    let ident = function.sig.ident.clone();
    let fn_name = ident.to_string();
    if !function.sig.generics.params.is_empty() {
        return Err(Error::new(
            function.sig.generics.span(),
            "components cannot be generic",
        ));
    }
    if function.sig.asyncness.is_some() {
        return Err(Error::new(
            function.sig.span(),
            "components cannot be async",
        ));
    }
    let mut inputs = function.sig.inputs.iter_mut();
    match inputs.next() {
        Some(FnArg::Typed(_)) => {}
        _ => {
            return Err(Error::new(
                function.sig.span(),
                "the first parameter must be the context: `cx: Cx`",
            ));
        }
    }
    let mut props: Vec<PropSpec> = Vec::new();
    let mut value: Option<ValueParam> = None;
    // What the component is called with after `cx`, in parameter order:
    // a prop by its index, or the value.
    let mut arguments: Vec<Option<usize>> = Vec::new();
    for input in inputs {
        let FnArg::Typed(input) = input else {
            return Err(Error::new(input.span(), "components cannot take self"));
        };
        if let Some((secret, validity)) = take_value_attr(&mut input.attrs)? {
            if value.is_some() {
                return Err(Error::new(
                    input.span(),
                    "a component has at most one value",
                ));
            }
            value = Some(value_param(&input.ty, secret, validity).ok_or_else(|| {
                Error::new(
                    input.ty.span(),
                    "the value is `Input<String>`, `Input<f64>` or `Input<bool>`",
                )
            })?);
            arguments.push(None);
            continue;
        }
        arguments.push(Some(props.len()));
        let attr = take_prop_attr(&mut input.attrs)?;
        let Pat::Ident(pattern) = &*input.pat else {
            return Err(Error::new(
                input.pat.span(),
                "props must be plain identifiers",
            ));
        };
        let prop_ident = pattern.ident.clone();
        let rust_name = prop_ident.to_string();
        let rust_name = rust_name.strip_prefix("r#").unwrap_or(&rust_name);
        let name = attr
            .name
            .as_ref()
            .map_or_else(|| camel_case(rust_name), LitStr::value);
        if name.starts_with('$') || name.is_empty() {
            return Err(Error::new(
                prop_ident.span(),
                "prop names cannot be empty or start with `$`",
            ));
        }
        let (base, array, nullable, enum_type) = match &attr.ty {
            Some(ty) => {
                let value = ty.value();
                let base = value.trim_end_matches("[]").to_owned();
                if !matches!(
                    base.as_str(),
                    "string" | "number" | "boolean" | "color" | "image" | "product"
                ) {
                    return Err(Error::new(ty.span(), "unknown prop type"));
                }
                (base, value.ends_with("[]"), true, None)
            }
            None => prop_shape(&input.ty).ok_or_else(|| {
                Error::new(
                    input.ty.span(),
                    "unsupported prop type; use String, a number, bool, Color, Image, Asset, Product, \
                     ProductId, an enum deriving PropEnum, Option<T> or Vec<T>",
                )
            })?,
        };
        let default = match &attr.default {
            // A component prop's default is the definition id shown when an
            // instance chooses none; it holds no value.
            Some(expr) if base == "component" => match json_from_expr(expr)? {
                Json::Str(id) if is_definition_id(&id) => Json::Null,
                _ => {
                    return Err(Error::new(
                        expr.span(),
                        "a component prop's default is a definition id, like \"voidhash/wheel\"",
                    ));
                }
            },
            Some(expr) if base == "content" => {
                return Err(Error::new(
                    expr.span(),
                    "a content prop has no default: the instance fills it",
                ));
            }
            Some(expr) => {
                let json = json_from_expr(expr)?;
                if !check_default(&json, &base, array, nullable) {
                    return Err(Error::new(
                        expr.span(),
                        format!(
                            "default does not match the prop's type `{base}{}`",
                            if array { "[]" } else { "" }
                        ),
                    ));
                }
                json
            }
            None => default_for(&base, array, nullable),
        };
        if props.iter().any(|prop: &PropSpec| prop.name == name) {
            return Err(Error::new(prop_ident.span(), "duplicate prop name"));
        }
        props.push(PropSpec {
            ident: prop_ident,
            ty: (*input.ty).clone(),
            name,
            base,
            array,
            enum_type,
            explicit_default: attr.default.is_some(),
            default,
            attr,
        });
    }

    let slug = match &args.name {
        Some(name) => {
            let value = name.value();
            if !is_kebab(&value) {
                return Err(Error::new(
                    name.span(),
                    "names are kebab-case, like `plan-picker`",
                ));
            }
            value
        }
        None => kebab_case(&fn_name),
    };
    let id = match &args.id {
        Some(id) => {
            let value = id.value();
            if !is_definition_id(&value) {
                return Err(Error::new(
                    id.span(),
                    "ids are `namespace/name`, like `acme/plan-picker`",
                ));
            }
            value
        }
        None => format!("project/{slug}"),
    };
    let version = args.version.as_ref().map_or_else(
        || std::env::var("CARGO_PKG_VERSION").unwrap_or_else(|_| "1".into()),
        LitStr::value,
    );
    let title = args
        .title
        .as_ref()
        .map_or_else(|| sentence_case(&fn_name), LitStr::value);
    let description = args
        .description
        .as_ref()
        .map_or_else(|| doc_text(&function.attrs), LitStr::value);
    let mut states: Vec<String> = args.states.iter().map(LitStr::value).collect();
    if states.is_empty() {
        states.push("default".to_owned());
    }
    for (index, state) in states.iter().enumerate() {
        if state.is_empty() || states[..index].contains(state) {
            return Err(Error::new(
                args.states[index].span(),
                "states must be unique and non-empty",
            ));
        }
    }
    for (index, event) in args.events.iter().enumerate() {
        if args.events[..index]
            .iter()
            .any(|other| other.name == event.name)
        {
            return Err(Error::new(Span::call_site(), "duplicate event name"));
        }
    }
    let block = quote::ToTokens::to_token_stream(&function.block);
    // A value and the text input element are guest ABI 3; a component that
    // uses neither stays ABI 2, which every runtime with components runs.
    // Content and component props, and props it writes or computes, are
    // guest ABI 4.
    let needs_4 = props
        .iter()
        .any(|prop| prop.slotted() || prop.attr.writes || prop.attr.computed);
    let abi = match args.abi {
        Some(2) if value.is_some() => {
            return Err(Error::new(
                Span::call_site(),
                "a component with a value is guest ABI 3",
            ));
        }
        Some(2 | 3) if needs_4 => {
            return Err(Error::new(
                Span::call_site(),
                "content and component props, and props a component writes or computes, are guest ABI 4",
            ));
        }
        Some(abi) => abi,
        None if needs_4 => 4,
        None if value.is_some() || calls_text_input(block.clone()) => 3,
        None => 2,
    };
    for prop in &props {
        if (prop.attr.writes || prop.attr.computed) && prop.slotted() {
            return Err(Error::new(
                prop.ident.span(),
                "content and component props are never written",
            ));
        }
        if prop.attr.writes && prop.attr.computed {
            return Err(Error::new(
                prop.ident.span(),
                "a prop is written or computed, not both",
            ));
        }
        if prop.base == "fill" && (prop.attr.writes || prop.attr.computed) {
            return Err(Error::new(
                prop.ident.span(),
                "a fill prop cannot be written",
            ));
        }
    }
    let children = if args.children_any {
        obj(vec![("kind", string("any"))])
    } else {
        // A content prop's slots are the prop's, not the instance's children.
        let slots: Vec<String> = args
            .slots
            .clone()
            .unwrap_or_else(|| slot_calls(block.clone()))
            .into_iter()
            .filter(|name| {
                !props
                    .iter()
                    .any(|prop| prop.slotted() && prop.name == *name)
            })
            .collect();
        if slots.is_empty() {
            obj(vec![("kind", string("none"))])
        } else {
            obj(vec![
                ("kind", string("slots")),
                (
                    "slots",
                    Json::Arr(
                        slots
                            .into_iter()
                            .map(|name| obj(vec![("name", Json::Str(name))]))
                            .collect(),
                    ),
                ),
            ])
        }
    };
    let const_ident = format_ident!("{}", screaming_snake_case(&fn_name));
    let width = args.width.clone().unwrap_or_else(|| string("fill"));
    let height = args.height.clone().unwrap_or_else(|| string("hug"));
    let definition = |implementation: Json| {
        let mut entries = vec![
            ("id", Json::Str(id.clone())),
            ("version", Json::Str(version.clone())),
            ("title", Json::Str(title.clone())),
            ("description", Json::Str(description.clone())),
            (
                "icon",
                obj(vec![
                    ("kind", string("builtin")),
                    (
                        "name",
                        Json::Str(
                            args.icon
                                .as_ref()
                                .map_or_else(|| "component".into(), LitStr::value),
                        ),
                    ),
                ]),
            ),
            (
                "category",
                Json::Str(
                    args.category
                        .as_ref()
                        .map_or_else(|| "Project".into(), LitStr::value),
                ),
            ),
            (
                "keywords",
                Json::Arr(
                    args.keywords
                        .iter()
                        .map(|keyword| Json::Str(keyword.value()))
                        .collect(),
                ),
            ),
            ("implementation", implementation),
            ("traits", Json::Obj(args.traits.clone())),
            ("children", children.clone()),
            (
                "props",
                Json::Arr(props.iter().map(PropSpec::definition).collect()),
            ),
            (
                "events",
                Json::Arr(
                    args.events
                        .iter()
                        .map(|event| {
                            obj(vec![
                                ("name", Json::Str(event.name.clone())),
                                (
                                    "payload",
                                    Json::Arr(
                                        event
                                            .payload
                                            .iter()
                                            .map(|(field, ty)| {
                                                obj(vec![
                                                    ("name", Json::Str(field.clone())),
                                                    ("type", payload_type(ty)),
                                                ])
                                            })
                                            .collect(),
                                    ),
                                ),
                            ])
                        })
                        .collect(),
                ),
            ),
            (
                "previewStates",
                Json::Arr(states.iter().cloned().map(Json::Str).collect()),
            ),
            (
                "capabilities",
                Json::Arr(
                    args.capabilities
                        .iter()
                        .map(|capability| Json::Str(capability.to_string()))
                        .collect(),
                ),
            ),
            // `voidhash_ui::export_panels!` gives the marker type an inherent
            // `HAS_PANEL`, which shadows the trait's `false`.
            (
                "panel",
                Json::Part(
                    quote!({
                        #[allow(unused_imports)]
                        use ::voidhash_ui::__private::NoPanel as _;
                        if #const_ident::HAS_PANEL { "true" } else { "false" }
                    })
                    .to_string(),
                ),
            ),
            (
                "fallback",
                Json::Str(
                    args.fallback
                        .as_ref()
                        .map_or_else(|| "placeholder".into(), LitStr::value),
                ),
            ),
            (
                "defaultSize",
                obj(vec![("width", width.clone()), ("height", height.clone())]),
            ),
        ];
        if args.follows_text_size {
            entries.push(("followsTextSize", Json::Bool(true)));
        }
        if let Some(value) = &value {
            let mut declared = vec![("type", string(value.kind))];
            if value.secret {
                declared.push(("secret", Json::Bool(true)));
            }
            declared.push(("validity", Json::Bool(value.validity)));
            entries.push(("value", obj(declared)));
        }
        obj(entries)
    };
    let parts = |json: Json| {
        let mut parts = Vec::new();
        json.write(&mut parts);
        let parts = parts.into_iter().map(|part| match part {
            Part::Text(text) => quote!(#text),
            Part::Code(code) => code.parse::<TokenStream2>().unwrap_or_default(),
        });
        quote!(&[#(#parts),*])
    };
    let wasm_parts = parts(definition(obj(vec![
        ("kind", string("wasm")),
        ("abi", Json::Num(f64::from(abi))),
    ])));
    let native_parts = parts(definition(obj(vec![
        ("kind", string("native")),
        ("name", Json::Str(id.clone())),
        ("minRuntime", Json::Num(f64::from(abi))),
    ])));

    // Unsuffixed: the guest export returns it as an `i32`, the native table
    // holds it as a `u32`.
    let abi_literal = proc_macro2::Literal::u32_unsuffixed(abi);
    let render_ident = format_ident!("__voidhash_render_{}", ident);
    let native_ident = format_ident!("{}_NATIVE", screaming_snake_case(&fn_name));
    let parts_ident = format_ident!("__VOIDHASH_PARTS_{}", screaming_snake_case(&fn_name));
    let native_parts_ident =
        format_ident!("__VOIDHASH_NATIVE_PARTS_{}", screaming_snake_case(&fn_name));
    let visibility = &function.vis;
    let prop_reads = arguments.iter().map(|argument| {
        let Some(prop) = argument.map(|index| &props[index]) else {
            let inner = value.as_ref().map(|value| &value.inner);
            return quote! { ::voidhash_ui::Input::<#inner>::read(props) };
        };
        let ty = &prop.ty;
        let name = &prop.name;
        if prop.slotted() {
            return quote! { <#ty>::named(#name) };
        }
        let mut default = Vec::new();
        if prop.base != "enum" || prop.explicit_default {
            prop.default.encode(&mut default);
        }
        let default = syn::LitByteStr::new(&default, Span::call_site());
        quote! { ::voidhash_ui::__private::prop::<#ty>(props, #name, #default) }
    });
    let type_checks = props.iter().filter(|prop| !prop.slotted()).map(|prop| {
        let ty = &prop.ty;
        let base = match prop.base.as_str() {
            "image" | "asset" => "asset",
            other => other,
        };
        let array = prop.array;
        let message = format!(
            "prop `{}`: the Rust type does not match prop type `{}{}`",
            prop.ident,
            prop.base,
            if prop.array { "[]" } else { "" }
        );
        quote! {
            const _: () = ::core::assert!(
                ::voidhash_ui::__private::declares::<#ty>(#base, #array),
                #message
            );
        }
    });
    function
        .attrs
        .push(syn::parse_quote!(#[allow(non_snake_case)]));
    // A component's parameters are its props, as many as it has.
    function
        .attrs
        .push(syn::parse_quote!(#[allow(clippy::too_many_arguments)]));

    Ok(quote! {
        #function

        #[doc(hidden)]
        #[allow(non_snake_case)]
        fn #render_ident(
            cx: ::voidhash_ui::Cx,
            props: &::voidhash_ui::Value,
        ) -> ::voidhash_ui::View {
            #ident(cx, #(#prop_reads),*)
        }

        #(#type_checks)*

        #[doc(hidden)]
        const #parts_ident: &[&str] = #wasm_parts;
        #[doc(hidden)]
        const #native_parts_ident: &[&str] = #native_parts;

        /// Whether the component ships an editor panel: `export_panels!`
        /// names this type to declare one.
        #[doc(hidden)]
        #[allow(non_camel_case_types)]
        #visibility struct #const_ident {}

        impl ::voidhash_ui::__private::NoPanel for #const_ident {}

        /// The component, for unit tests with `voidhash_ui::testing::Harness`.
        #visibility const #const_ident: ::voidhash_ui::Component = ::voidhash_ui::Component {
            name: #id,
            manifest: ::voidhash_ui::__manifest!(#parts_ident),
            render: #render_ident,
        };

        ::voidhash_ui::__guest_exports!(#render_ident, #parts_ident, #abi_literal);
        ::voidhash_ui::__native_module!(#visibility #native_ident, #render_ident, #native_parts_ident, #abi_literal);
    })
}

/// The slots the body renders: `slot()` calls render `default`,
/// `slot_named("…")` calls their name.
fn slot_calls(tokens: TokenStream2) -> Vec<String> {
    let mut names = Vec::new();
    let mut previous: Option<String> = None;
    for token in tokens {
        match token {
            TokenTree::Ident(ident) => {
                previous = Some(ident.to_string());
                continue;
            }
            TokenTree::Group(group) => {
                if group.delimiter() == proc_macro2::Delimiter::Parenthesis {
                    match previous.as_deref() {
                        Some("slot") if group.stream().is_empty() => {
                            names.push("default".to_owned());
                        }
                        Some("slot_named") => {
                            if let Ok(name) = syn::parse2::<LitStr>(group.stream()) {
                                names.push(name.value());
                            }
                        }
                        _ => {}
                    }
                }
                for name in slot_calls(group.stream()) {
                    names.push(name);
                }
            }
            TokenTree::Punct(_) | TokenTree::Literal(_) => {}
        }
        previous = None;
    }
    let mut unique = Vec::new();
    for name in names {
        if !unique.contains(&name) {
            unique.push(name);
        }
    }
    unique
}

// PropEnum --------------------------------------------------------------------------

fn derive_prop_enum(input: DeriveInput) -> Result<TokenStream2> {
    let Data::Enum(data) = &input.data else {
        return Err(Error::new(input.ident.span(), "PropEnum derives on enums"));
    };
    let ident = &input.ident;
    let mut options = Vec::new();
    let mut variants = Vec::new();
    let mut titles: Vec<String> = Vec::new();
    let mut default = None;
    for variant in &data.variants {
        if !matches!(variant.fields, Fields::Unit) {
            return Err(Error::new(
                variant.span(),
                "PropEnum variants carry no fields",
            ));
        }
        let mut value = camel_case(&snake_case(&variant.ident.to_string()));
        let mut title = sentence_case(&variant.ident.to_string());
        for attr in &variant.attrs {
            if attr.path().is_ident("default") {
                default = Some(variant.ident.clone());
            }
            if attr.path().is_ident("prop_enum") {
                attr.parse_nested_meta(|meta| {
                    if meta.path.is_ident("value") {
                        value = meta.value()?.parse::<LitStr>()?.value();
                    } else if meta.path.is_ident("title") {
                        title = meta.value()?.parse::<LitStr>()?.value();
                    } else {
                        return Err(meta.error("expected value or title"));
                    }
                    Ok(())
                })?;
            }
        }
        options.push(obj(vec![
            ("value", Json::Str(value.clone())),
            ("title", Json::Str(title.clone())),
        ]));
        variants.push((variant.ident.clone(), value));
        titles.push(title);
    }
    let Some((first, _)) = variants.first() else {
        return Err(Error::new(ident.span(), "a PropEnum needs a variant"));
    };
    let default = default.unwrap_or_else(|| first.clone());
    let default_value = variants
        .iter()
        .find(|(variant, _)| *variant == default)
        .map(|(_, value)| value.clone())
        .unwrap_or_default();
    let mut options_json = String::new();
    let mut parts = Vec::new();
    Json::Arr(options).write(&mut parts);
    for part in parts {
        if let Part::Text(text) = part {
            options_json.push_str(&text);
        }
    }
    let mut default_json = String::new();
    write_json_string(&mut default_json, &default_value);
    let pairs = variants
        .iter()
        .zip(&titles)
        .map(|((_, value), title)| quote!((#value, #title)));
    let arms = variants
        .iter()
        .map(|(variant, value)| quote!(#value => Some(Self::#variant)));
    let names = variants
        .iter()
        .map(|(variant, value)| quote!(Self::#variant => #value));
    Ok(quote! {
        impl ::voidhash_ui::PropEnum for #ident {
            const OPTIONS: &'static str = #options_json;
            const DEFAULT: &'static str = #default_json;
            const VARIANTS: &'static [(&'static str, &'static str)] = &[#(#pairs),*];

            fn from_option(value: &str) -> Option<Self> {
                match value {
                    #(#arms,)*
                    _ => None,
                }
            }

            fn option(&self) -> &'static str {
                match self {
                    #(#names,)*
                }
            }
        }

        impl ::core::default::Default for #ident {
            fn default() -> Self {
                Self::#default
            }
        }

        impl ::voidhash_ui::Prop for #ident {
            const TYPE: &'static str = "enum";
            fn from_value(value: &::voidhash_ui::Value) -> Option<Self> {
                value.as_str().and_then(<Self as ::voidhash_ui::PropEnum>::from_option)
            }
        }

        impl ::voidhash_ui::ScalarProp for #ident {}
    })
}

// Names -----------------------------------------------------------------------------

fn words(pascal: &str) -> Vec<String> {
    let mut words: Vec<String> = Vec::new();
    for character in pascal.chars() {
        if character == '_' {
            words.push(String::new());
            continue;
        }
        let starts_word = character.is_ascii_uppercase()
            && words.last().is_some_and(|word| {
                word.chars()
                    .last()
                    .is_some_and(|last| !last.is_ascii_uppercase())
            });
        if starts_word || words.is_empty() {
            words.push(String::new());
        }
        if let Some(word) = words.last_mut() {
            word.push(character.to_ascii_lowercase());
        }
    }
    words.retain(|word| !word.is_empty());
    words
}

fn kebab_case(name: &str) -> String {
    words(name).join("-")
}

fn snake_case(name: &str) -> String {
    words(name).join("_")
}

fn screaming_snake_case(name: &str) -> String {
    words(name).join("_").to_ascii_uppercase()
}

fn sentence_case(name: &str) -> String {
    let mut sentence = words(name).join(" ");
    if let Some(first) = sentence.get_mut(0..1) {
        first.make_ascii_uppercase();
    }
    sentence
}

fn camel_case(snake: &str) -> String {
    let mut out = String::new();
    let mut upper = false;
    for character in snake.chars() {
        if character == '_' {
            upper = !out.is_empty();
        } else if upper {
            out.push(character.to_ascii_uppercase());
            upper = false;
        } else {
            out.push(character);
        }
    }
    out
}

fn is_kebab(name: &str) -> bool {
    name.starts_with(|c: char| c.is_ascii_lowercase() || c.is_ascii_digit())
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        && !name.ends_with('-')
        && !name.contains("--")
}

fn is_definition_id(id: &str) -> bool {
    id.split_once('/').is_some_and(|(namespace, name)| {
        is_kebab(namespace)
            && name.starts_with(|c: char| c.is_ascii_alphanumeric())
            && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    })
}

/// The doc comment as plain text: lines joined with spaces, blank lines kept
/// as paragraph breaks.
fn doc_text(attrs: &[Attribute]) -> String {
    let mut paragraphs: Vec<String> = vec![String::new()];
    for attr in attrs {
        if !attr.path().is_ident("doc") {
            continue;
        }
        let syn::Meta::NameValue(meta) = &attr.meta else {
            continue;
        };
        let Expr::Lit(ExprLit {
            lit: Lit::Str(line),
            ..
        }) = &meta.value
        else {
            continue;
        };
        let line = line.value();
        let line = line.trim();
        let current = paragraphs.last_mut().expect("paragraphs is never empty");
        if line.is_empty() {
            if !current.is_empty() {
                paragraphs.push(String::new());
            }
        } else {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(line);
        }
    }
    paragraphs.retain(|paragraph| !paragraph.is_empty());
    paragraphs.join("\n\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_names() {
        assert_eq!(kebab_case("PlanPicker"), "plan-picker");
        assert_eq!(kebab_case("CatchTheCoin"), "catch-the-coin");
        assert_eq!(screaming_snake_case("CatchTheCoin"), "CATCH_THE_COIN");
        assert_eq!(sentence_case("CountdownOffer"), "Countdown offer");
        assert_eq!(camel_case("coin_color"), "coinColor");
        assert_eq!(camel_case(&snake_case("ProgressRing")), "progressRing");
        assert!(is_kebab("plan-picker"));
        assert!(!is_kebab("Plan"));
        assert!(is_definition_id("acme/WheelPicker"));
        assert!(!is_definition_id("Acme/wheel"));
    }

    #[test]
    fn converts_defaults() {
        let expr: Expr = syn::parse_quote!(vec!["a", -1.5, true, None]);
        assert_eq!(
            json_from_expr(&expr).unwrap(),
            Json::Arr(vec![
                Json::Str("a".into()),
                Json::Num(-1.5),
                Json::Bool(true),
                Json::Null
            ])
        );
    }

    #[test]
    fn writes_json_with_compiler_filled_parts() {
        let mut parts = Vec::new();
        obj(vec![
            ("a\"b", Json::Num(16.0)),
            ("options", Json::Part("X::OPTIONS".into())),
        ])
        .write(&mut parts);
        let texts: Vec<String> = parts
            .into_iter()
            .map(|part| match part {
                Part::Text(text) => text,
                Part::Code(code) => format!("<{code}>"),
            })
            .collect();
        assert_eq!(texts, [r#"{"a\"b":16,"options":"#, "<X::OPTIONS>", "}"]);
    }

    #[test]
    fn maps_rust_types() {
        let ty: Type = syn::parse_quote!(Option<Vec<Product>>);
        assert_eq!(
            prop_shape(&ty).map(|(base, array, nullable, _)| (base, array, nullable)),
            Some(("product".into(), true, true))
        );
        let ty: Type = syn::parse_quote!(Vec<Option<String>>);
        assert!(prop_shape(&ty).is_none());
        let ty: Type = syn::parse_quote!(Ring);
        assert_eq!(prop_shape(&ty).map(|(base, ..)| base), Some("enum".into()));
    }

    #[test]
    fn reads_the_value_a_parameter_declares() {
        let declared = |ty: &str, secret: bool| {
            value_param(&syn::parse_str(ty).unwrap(), secret, false)
                .map(|value| (value.kind, value.secret))
        };
        assert_eq!(declared("Input<f64>", false), Some(("number", false)));
        assert_eq!(declared("Input<String>", true), Some(("string", true)));
        assert_eq!(
            declared("voidhash_ui::Input<bool>", false),
            Some(("boolean", false))
        );
        assert_eq!(declared("Input<Vec<String>>", false), Some(("list", false)));
        assert_eq!(declared("f64", false), None);
        assert_eq!(declared("Input<Color>", false), None);
        assert_eq!(declared("Input<Vec<f64>>", false), None);
    }

    #[test]
    fn finds_the_text_input_element() {
        assert!(calls_text_input(quote! {
            vstack().child(text_input().placeholder("Code"))
        }));
        assert!(!calls_text_input(quote! { let text_input = 1; text("Hi") }));
        assert!(!calls_text_input(quote! { vstack() }));
    }

    #[test]
    fn finds_rendered_slots() {
        assert_eq!(slot_calls(quote!({ vstack().child(slot()) })), ["default"]);
        assert_eq!(
            slot_calls(quote!({
                vstack().child(slot_named("footer")).child(slot())
            })),
            ["footer", "default"]
        );
        assert!(
            slot_calls(quote!({
                let slot = 1;
                text("slot")
            }))
            .is_empty()
        );
    }
}
