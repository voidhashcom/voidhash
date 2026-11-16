<?php

namespace Voidhash\Generated\Core\Model;

class CreateFeatureFlagBodyJsonEncoding
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
     * The flag's key, unique in the project; SDKs ask for the flag by it.
     *
     * @var string
     */
    protected $key;
    /**
     * What the flag controls.
     *
     * @var string|null
     */
    protected $description;
    /**
     * What the flag evaluates to: only on or off (`boolean`), or also one of its variants' values, each a `string`, a `number` or any `json`. It cannot change once the flag is created.
     *
     * @var string
     */
    protected $type;
    /**
     * The values a `string`, `number` or `json` flag can evaluate to, at least one; traffic splits evenly between them. A `boolean` flag takes none.
     *
     * @var list<CreateFeatureFlagBodyJsonEncodingVariantsItem>|null
     */
    protected $variants;
    /**
     * The flag's key, unique in the project; SDKs ask for the flag by it.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The flag's key, unique in the project; SDKs ask for the flag by it.
     *
     * @param string $key
     *
     * @return self
     */
    public function setKey(string $key): self
    {
        $this->initialized['key'] = true;
        $this->key = $key;
        return $this;
    }
    /**
     * What the flag controls.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What the flag controls.
     *
     * @param string|null $description
     *
     * @return self
     */
    public function setDescription(?string $description): self
    {
        $this->initialized['description'] = true;
        $this->description = $description;
        return $this;
    }
    /**
     * What the flag evaluates to: only on or off (`boolean`), or also one of its variants' values, each a `string`, a `number` or any `json`. It cannot change once the flag is created.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * What the flag evaluates to: only on or off (`boolean`), or also one of its variants' values, each a `string`, a `number` or any `json`. It cannot change once the flag is created.
     *
     * @param string $type
     *
     * @return self
     */
    public function setType(string $type): self
    {
        $this->initialized['type'] = true;
        $this->type = $type;
        return $this;
    }
    /**
     * The values a `string`, `number` or `json` flag can evaluate to, at least one; traffic splits evenly between them. A `boolean` flag takes none.
     *
     * @return list<CreateFeatureFlagBodyJsonEncodingVariantsItem>|null
     */
    public function getVariants(): ?array
    {
        return $this->variants;
    }
    /**
     * The values a `string`, `number` or `json` flag can evaluate to, at least one; traffic splits evenly between them. A `boolean` flag takes none.
     *
     * @param list<CreateFeatureFlagBodyJsonEncodingVariantsItem>|null $variants
     *
     * @return self
     */
    public function setVariants(?array $variants): self
    {
        $this->initialized['variants'] = true;
        $this->variants = $variants;
        return $this;
    }
}