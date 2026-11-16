<?php

namespace Voidhash\Generated\Core\Model;

class AdsReportedMetricsResultsItem
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
     * The kind of result, such as `website_purchase` or `app_install`; one without its own code is `other`, named by `label`.
     *
     * @var string
     */
    protected $type;
    /**
     * The platform's label of an `other` result; null for the rest.
     *
     * @var string|null
     */
    protected $label;
    /**
     * How many results of the type the platform counted.
     *
     * @var int
     */
    protected $count;
    /**
     * The kind of result, such as `website_purchase` or `app_install`; one without its own code is `other`, named by `label`.
     *
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }
    /**
     * The kind of result, such as `website_purchase` or `app_install`; one without its own code is `other`, named by `label`.
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
     * The platform's label of an `other` result; null for the rest.
     *
     * @return string|null
     */
    public function getLabel(): ?string
    {
        return $this->label;
    }
    /**
     * The platform's label of an `other` result; null for the rest.
     *
     * @param string|null $label
     *
     * @return self
     */
    public function setLabel(?string $label): self
    {
        $this->initialized['label'] = true;
        $this->label = $label;
        return $this;
    }
    /**
     * How many results of the type the platform counted.
     *
     * @return int
     */
    public function getCount(): int
    {
        return $this->count;
    }
    /**
     * How many results of the type the platform counted.
     *
     * @param int $count
     *
     * @return self
     */
    public function setCount(int $count): self
    {
        $this->initialized['count'] = true;
        $this->count = $count;
        return $this;
    }
}