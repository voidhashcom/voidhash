<?php

namespace Voidhash\Generated\Core\Model;

class SchemaNativeEnumType
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
     * Always `enum`.
     *
     * @var string
     */
    protected $kind;
    /**
     * The values the property can hold, in the designer's order.
     *
     * @var list<string>
     */
    protected $options;
    /**
     * Always `enum`.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * Always `enum`.
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
     * The values the property can hold, in the designer's order.
     *
     * @return list<string>
     */
    public function getOptions(): array
    {
        return $this->options;
    }
    /**
     * The values the property can hold, in the designer's order.
     *
     * @param list<string> $options
     *
     * @return self
     */
    public function setOptions(array $options): self
    {
        $this->initialized['options'] = true;
        $this->options = $options;
        return $this;
    }
}