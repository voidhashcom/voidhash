//! Typed component props decoded from the host's props object.

use alloc::string::String;
use alloc::vec::Vec;
use core::ops::Deref;

use crate::style::Color;
use crate::value::Value;
use crate::view::View;

/// A type a component can take as a prop.
///
/// `TYPE` is the prop kind of the component definition (`string`, `number`,
/// `boolean`, `color`, `fill`, `asset`, `product` or `enum`); `ARRAY` marks
/// `Vec<T>` props, which are lists.
pub trait Prop: Sized + Default {
    /// The manifest type of the prop's items.
    const TYPE: &'static str;
    /// Whether the prop is an array of `TYPE`.
    const ARRAY: bool = false;
    /// Reads the prop from its value, or `None` when the value has the wrong
    /// type.
    fn from_value(value: &Value) -> Option<Self>;
}

/// A prop type that can be an item of a `Vec` prop.
pub trait ScalarProp: Prop {}

impl Prop for String {
    const TYPE: &'static str = "string";
    fn from_value(value: &Value) -> Option<Self> {
        value.as_str().map(String::from)
    }
}

impl Prop for bool {
    const TYPE: &'static str = "boolean";
    fn from_value(value: &Value) -> Option<Self> {
        value.as_bool()
    }
}

impl Prop for f64 {
    const TYPE: &'static str = "number";
    fn from_value(value: &Value) -> Option<Self> {
        value.as_f64()
    }
}

impl Prop for f32 {
    const TYPE: &'static str = "number";
    fn from_value(value: &Value) -> Option<Self> {
        value.as_f64().map(|number| number as f32)
    }
}

macro_rules! integer_prop {
    ($($integer:ty),*) => {$(
        impl Prop for $integer {
            const TYPE: &'static str = "number";
            /// Rounds towards zero and saturates at the type's bounds.
            fn from_value(value: &Value) -> Option<Self> {
                value.as_f64().filter(|number| !number.is_nan()).map(|number| number as $integer)
            }
        }
        impl ScalarProp for $integer {}
    )*};
}

integer_prop!(i32, i64, u32, u64, usize);

impl Prop for Color {
    const TYPE: &'static str = "color";
    fn from_value(value: &Value) -> Option<Self> {
        value.as_str().and_then(Color::parse)
    }
}

impl ScalarProp for String {}
impl ScalarProp for bool {}
impl ScalarProp for f64 {}
impl ScalarProp for f32 {}
impl ScalarProp for Color {}

/// An image URL prop.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Image(pub String);

impl Deref for Image {
    type Target = str;
    fn deref(&self) -> &str {
        &self.0
    }
}

impl AsRef<str> for Image {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl From<&Image> for String {
    fn from(image: &Image) -> String {
        image.0.clone()
    }
}

impl Prop for Image {
    const TYPE: &'static str = "asset";
    fn from_value(value: &Value) -> Option<Self> {
        value.as_str().map(|url| Image(String::from(url)))
    }
}

impl ScalarProp for Image {}

/// An asset prop: the id or URL of an asset of the kinds the prop accepts
/// (`#[prop(accepts(image))]`, images by default).
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Asset(pub String);

impl Deref for Asset {
    type Target = str;
    fn deref(&self) -> &str {
        &self.0
    }
}

impl Prop for Asset {
    const TYPE: &'static str = "asset";
    fn from_value(value: &Value) -> Option<Self> {
        value.as_str().map(|asset| Asset(String::from(asset)))
    }
}

impl ScalarProp for Asset {}

/// A fill prop as the paywall document stores it: a colour, or an object
/// with a `type` of `solid`, `gradient` or `image`. Pass it to an element's
/// `fills` style.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Fill(pub Value);

impl Prop for Fill {
    const TYPE: &'static str = "fill";
    fn from_value(value: &Value) -> Option<Self> {
        match value {
            Value::String(_) | Value::Object(_) => Some(Fill(value.clone())),
            _ => None,
        }
    }
}

impl ScalarProp for Fill {}

/// A fieldless enum as an `enum` prop, implemented by
/// `#[derive(PropEnum)]`.
pub trait PropEnum: Sized {
    /// The options as definition JSON (`[{"value", "title"}, …]`).
    const OPTIONS: &'static str;
    /// The default option's value as a JSON string.
    const DEFAULT: &'static str;
    /// Each variant's option value and title, in declaration order.
    const VARIANTS: &'static [(&'static str, &'static str)];
    /// The variant whose option value is `value`.
    fn from_option(value: &str) -> Option<Self>;
    /// The variant's option value.
    fn option(&self) -> &'static str;
}

/// A store product with its localized, display-ready fields.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Product {
    /// The product id to [purchase](crate::EventCx::purchase).
    pub id: ProductId,
    /// Display name.
    pub title: String,
    /// Localized price, for example `$59.99`.
    pub price: String,
    /// Localized billing period, for example `year`, when it is a
    /// subscription.
    pub period: Option<String>,
    /// Localized free trial, for example `7-day free trial`.
    pub trial: Option<String>,
    /// ISO currency code.
    pub currency: Option<String>,
}

impl Product {
    /// The price with its period, for example `$59.99 / year`.
    pub fn price_per_period(&self) -> String {
        let mut text = self.price.clone();
        if let Some(period) = &self.period {
            text.push_str(" / ");
            text.push_str(period);
        }
        text
    }
}

impl Prop for Product {
    const TYPE: &'static str = "product";
    fn from_value(value: &Value) -> Option<Self> {
        let field = |key| value.get(key).and_then(Value::as_str).map(String::from);
        value.as_object()?;
        Some(Product {
            id: ProductId(field("id").unwrap_or_default()),
            title: field("title").unwrap_or_default(),
            price: field("price").unwrap_or_default(),
            period: field("period"),
            trial: field("trial"),
            currency: field("currency"),
        })
    }
}

impl ScalarProp for Product {}

/// The id of a store product. As a prop, it reads the id of a `product`.
#[derive(Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ProductId(pub String);

impl Deref for ProductId {
    type Target = str;
    fn deref(&self) -> &str {
        &self.0
    }
}

impl AsRef<str> for ProductId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl From<&str> for ProductId {
    fn from(id: &str) -> ProductId {
        ProductId(String::from(id))
    }
}

impl From<&ProductId> for String {
    fn from(id: &ProductId) -> String {
        id.0.clone()
    }
}

impl From<ProductId> for String {
    fn from(id: ProductId) -> String {
        id.0
    }
}

impl From<ProductId> for Value {
    fn from(id: ProductId) -> Value {
        Value::String(id.0)
    }
}

impl From<&ProductId> for Value {
    fn from(id: &ProductId) -> Value {
        Value::String(id.0.clone())
    }
}

impl Prop for ProductId {
    const TYPE: &'static str = "product";
    fn from_value(value: &Value) -> Option<Self> {
        match value {
            Value::String(id) => Some(ProductId(id.clone())),
            Value::Object(_) => value.get("id").and_then(Value::as_str).map(ProductId::from),
            _ => None,
        }
    }
}

impl ScalarProp for ProductId {}

impl<T: Prop> Prop for Option<T> {
    const TYPE: &'static str = T::TYPE;
    const ARRAY: bool = T::ARRAY;
    fn from_value(value: &Value) -> Option<Self> {
        if value.is_null() {
            Some(None)
        } else {
            T::from_value(value).map(Some)
        }
    }
}

impl<T: ScalarProp> Prop for Vec<T> {
    const TYPE: &'static str = T::TYPE;
    const ARRAY: bool = true;
    /// Skips items of the wrong type.
    fn from_value(value: &Value) -> Option<Self> {
        Some(value.as_array()?.iter().filter_map(T::from_value).collect())
    }
}

/// Reads prop `name`, falling back to its encoded manifest default and then
/// to the type's `Default`.
pub(crate) fn read<T: Prop>(props: &Value, name: &str, default: &[u8]) -> T {
    props
        .get(name)
        .and_then(T::from_value)
        .or_else(|| Value::decode(default).ok().as_ref().and_then(T::from_value))
        .unwrap_or_default()
}

/// A content prop (guest ABI 4): content the instance fills where the
/// component is used, which the component shows where and as often as it
/// decides, handing it the values of the params it declared.
///
/// ```ignore
/// #[component]
/// pub fn Carousel(
///     cx: Cx,
///     #[prop(params(item: String, index: f64))] card: Content,
///     items: Vec<String>,
/// ) -> View {
///     hstack().children(items.iter().enumerate().map(|(index, item)| {
///         card.show(item.clone(), object([("item", item.as_str().into()), ("index", index.into())]))
///     }))
/// }
/// ```
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Content {
    name: String,
}

impl Content {
    /// The content prop of this name. Used by `#[component]`.
    #[doc(hidden)]
    pub fn named(name: &str) -> Content {
        Content {
            name: String::from(name),
        }
    }

    /// Where one copy of the content shows: one per distinct `key`, kept
    /// while a render shows that key again, with `params` (an object of the
    /// declared params) set each time. A press inside the copy acts with
    /// the params it was given.
    pub fn show(&self, key: impl Into<String>, params: Value) -> View {
        crate::view::content_slot(&self.name, key.into(), params)
    }

    /// Where the content shows once, without params.
    pub fn once(&self) -> View {
        self.show("", Value::Object(crate::value::Map::new()))
    }
}

/// A component prop (guest ABI 4): a component the instance chooses, which
/// must meet the contract the prop declares (`accepts`). The component
/// creates as many of it as it wants, setting the contract's props and
/// receiving its events.
///
/// ```ignore
/// #[component]
/// pub fn Badges(
///     cx: Cx,
///     #[prop(accepts(props(label: String), events(chosen)))] badge: ComponentProp,
///     items: Vec<String>,
/// ) -> View {
///     hstack().children(items.iter().map(|item| {
///         badge
///             .show(item.clone(), object([("label", item.as_str().into())]))
///             .on_event(|cx, name, payload| { /* `chosen` of one badge */ })
///     }))
/// }
/// ```
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct ComponentProp {
    name: String,
}

impl ComponentProp {
    /// The component prop of this name. Used by `#[component]`.
    #[doc(hidden)]
    pub fn named(name: &str) -> ComponentProp {
        ComponentProp {
            name: String::from(name),
        }
    }

    /// Where one instance of the chosen component shows: one per distinct
    /// `key`, kept while a render shows that key again, with `props` (an
    /// object of the contract's props) set each time over the props the
    /// instance gave it. Its writes to those props are dropped: they are
    /// this component's to set. Its contract events reach the element's
    /// [`on_event`](View::on_event).
    pub fn show(&self, key: impl Into<String>, props: Value) -> View {
        crate::view::chosen_component(&self.name, key.into(), props)
    }
}

/// Whether `T` declares manifest type `ty` (compile-time check of the
/// `#[component]` expansion).
pub const fn declares<T: Prop>(ty: &str, array: bool) -> bool {
    let (a, b) = (T::TYPE.as_bytes(), ty.as_bytes());
    if a.len() != b.len() || T::ARRAY != array {
        return false;
    }
    let mut index = 0;
    while index < a.len() {
        if a[index] != b[index] {
            return false;
        }
        index += 1;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value::object;
    use alloc::vec;

    #[test]
    fn decodes_products() {
        let value = object([
            ("id", "pro-annual".into()),
            ("title", "Annual".into()),
            ("price", "$59.99".into()),
            ("period", "year".into()),
            ("trial", Value::Null),
            ("currency", "USD".into()),
        ]);
        let product = Product::from_value(&value).unwrap();
        assert_eq!(&*product.id, "pro-annual");
        assert_eq!(product.price_per_period(), "$59.99 / year");
        assert_eq!(product.trial, None);
        assert_eq!(
            ProductId::from_value(&value),
            Some(ProductId::from("pro-annual"))
        );
    }

    #[test]
    fn reads_with_fallbacks() {
        let props = object([
            ("count", 3.into()),
            ("wrong", "text".into()),
            (
                "list",
                vec![Value::from("a"), Value::from(1), Value::from("b")].into(),
            ),
            ("nothing", Value::Null),
        ]);
        let default = Value::from(7).to_bytes();
        assert_eq!(read::<u32>(&props, "count", &default), 3);
        assert_eq!(read::<u32>(&props, "wrong", &default), 7);
        assert_eq!(read::<u32>(&props, "missing", &[]), 0);
        assert_eq!(read::<Vec<String>>(&props, "list", &[]), ["a", "b"]);
        assert_eq!(read::<Option<Product>>(&props, "nothing", &[]), None);
        assert!(declares::<Option<Vec<Color>>>("color", true));
        assert!(!declares::<String>("number", false));
    }
}
