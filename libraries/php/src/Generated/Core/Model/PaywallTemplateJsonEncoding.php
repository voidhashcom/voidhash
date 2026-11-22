<?php

namespace Voidhash\Generated\Core\Model;

class PaywallTemplateJsonEncoding
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
     * The template's id, which `paywalls.create` takes as `template`.
     *
     * @var string
     */
    protected $id;
    /**
     * The template's name.
     *
     * @var string
     */
    protected $name;
    /**
     * What the template's design holds.
     *
     * @var string
     */
    protected $description;
    /**
     * What the flow is for: `paywall`, `onboarding`, `feedback`, `reactivation` or `custom`. It labels and groups flows, and decides nothing a flow may do.
     *
     * @var string
     */
    protected $kind;
    /**
     * The slugs of the products the design sells. Create products with these slugs, or choose other products in the designer.
     *
     * @var list<string>
     */
    protected $productSlugs;
    /**
     * The template's id, which `paywalls.create` takes as `template`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The template's id, which `paywalls.create` takes as `template`.
     *
     * @param string $id
     *
     * @return self
     */
    public function setId(string $id): self
    {
        $this->initialized['id'] = true;
        $this->id = $id;
        return $this;
    }
    /**
     * The template's name.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The template's name.
     *
     * @param string $name
     *
     * @return self
     */
    public function setName(string $name): self
    {
        $this->initialized['name'] = true;
        $this->name = $name;
        return $this;
    }
    /**
     * What the template's design holds.
     *
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
     * What the template's design holds.
     *
     * @param string $description
     *
     * @return self
     */
    public function setDescription(string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * What the flow is for: `paywall`, `onboarding`, `feedback`, `reactivation` or `custom`. It labels and groups flows, and decides nothing a flow may do.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What the flow is for: `paywall`, `onboarding`, `feedback`, `reactivation` or `custom`. It labels and groups flows, and decides nothing a flow may do.
     *
     * @param string $kind
     *
     * @return self
     */
    public function setKind(string $kind): self
    {
        $this->initialized['kind'] = true;
        $this->kind = $kind;
        return $this;
    }
    /**
     * The slugs of the products the design sells. Create products with these slugs, or choose other products in the designer.
     *
     * @return list<string>
     */
    public function getProductSlugs(): array
    {
        return $this->productSlugs;
    }
    /**
     * The slugs of the products the design sells. Create products with these slugs, or choose other products in the designer.
     *
     * @param list<string> $productSlugs
     *
     * @return self
     */
    public function setProductSlugs(array $productSlugs): self
    {
        $this->initialized['productSlugs'] = true;
        $this->productSlugs = $productSlugs;
        return $this;
    }
}