# voidhash-ui-macros

The procedural macros of [`voidhash-ui`](https://crates.io/crates/voidhash-ui):
`#[component]`, `#[derive(PropEnum)]` and the `#[panel]` attributes of editor
panels.

Don't depend on this crate directly. `voidhash-ui` re-exports every macro, and
the code they generate names `voidhash-ui`, which releases with this crate at
the same version:

```toml
[dependencies]
voidhash-ui = "0.1"
```

See the [`voidhash-ui` documentation](https://docs.rs/voidhash-ui) and the
[component guides](https://voidhash.com/docs/components).

## License

MIT
