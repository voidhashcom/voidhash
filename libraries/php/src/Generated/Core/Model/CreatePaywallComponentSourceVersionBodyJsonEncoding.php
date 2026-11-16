<?php

namespace Voidhash\Generated\Core\Model;

class CreatePaywallComponentSourceVersionBodyJsonEncoding
{
    /**
     * @var array
     */
    protected $initialized = [];
    public function isInitialized($property): bool
    {
        return array_key_exists($property, $this->initialized);
    }
    /**
     * The slug of the component to add the version to, created when the project has none: lowercase letters, digits and dashes, at most 63 characters.
     *
     * @var string
     */
    protected $slug;
    /**
     * The component's title; defaults to the slug for a new component. Given for an existing one, it renames it.
     *
     * @var string|null
     */
    protected $title;
    /**
     * The crate's files, keyed by path. `src/lib.rs` is required, other modules live under `src/`, and an optional `Cargo.toml` may only declare the `voidhash-ui` dependency.
     *
     * @var array<string, string>
     */
    protected $files;
    /**
     * The slug of the component to add the version to, created when the project has none: lowercase letters, digits and dashes, at most 63 characters.
     *
     * @return string
     */
    public function getSlug(): string
    {
        return $this->slug;
    }
    /**
     * The slug of the component to add the version to, created when the project has none: lowercase letters, digits and dashes, at most 63 characters.
     *
     * @param string $slug
     *
     * @return self
     */
    public function setSlug(string $slug): self
    {
        $this->initialized['slug'] = true;
        $this->slug = $slug;
        return $this;
    }
    /**
     * The component's title; defaults to the slug for a new component. Given for an existing one, it renames it.
     *
     * @return string|null
     */
    public function getTitle(): ?string
    {
        return $this->title;
    }
    /**
     * The component's title; defaults to the slug for a new component. Given for an existing one, it renames it.
     *
     * @param string|null $title
     *
     * @return self
     */
    public function setTitle(?string $title): self
    {
        $this->initialized['title'] = true;
        $this->title = $title;
        return $this;
    }
    /**
     * The crate's files, keyed by path. `src/lib.rs` is required, other modules live under `src/`, and an optional `Cargo.toml` may only declare the `voidhash-ui` dependency.
     *
     * @return array<string, string>
     */
    public function getFiles(): iterable
    {
        return $this->files;
    }
    /**
     * The crate's files, keyed by path. `src/lib.rs` is required, other modules live under `src/`, and an optional `Cargo.toml` may only declare the `voidhash-ui` dependency.
     *
     * @param array<string, string> $files
     *
     * @return self
     */
    public function setFiles(iterable $files): self
    {
        $this->initialized['files'] = true;
        $this->files = $files;
        return $this;
    }
}