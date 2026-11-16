<?php

namespace Voidhash\Generated\Core\Model;

class AutomationField
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
     * The setting's key in the trigger's or step's `config`.
     *
     * @var string
     */
    protected $key;
    /**
     * The setting's name, as Studio shows it.
     *
     * @var string
     */
    protected $label;
    /**
     * What kind of value the setting holds, such as `text`, `template` (text that can read data as `{{ path }}`), `event`, `duration` or `condition`.
     *
     * @var string
     */
    protected $kind;
    /**
     * What the setting does; null when its label says enough.
     *
     * @var string|null
     */
    protected $description;
    /**
     * Whether the automation can't be activated without it.
     *
     * @var bool
     */
    protected $isRequired;
    /**
     * A sample value Studio shows in an empty setting; null for none.
     *
     * @var string|null
     */
    protected $placeholder;
    /**
     * The most characters a text setting takes; null for no limit.
     *
     * @var int|null
     */
    protected $maxLength;
    /**
     * The setting's key in the trigger's or step's `config`.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The setting's key in the trigger's or step's `config`.
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
     * The setting's name, as Studio shows it.
     *
     * @return string
     */
    public function getLabel(): string
    {
        return $this->label;
    }
    /**
     * The setting's name, as Studio shows it.
     *
     * @param string $label
     *
     * @return self
     */
    public function setLabel(string $label): self
    {
        $this->initialized['label'] = true;
        $this->label = $label;
        return $this;
    }
    /**
     * What kind of value the setting holds, such as `text`, `template` (text that can read data as `{{ path }}`), `event`, `duration` or `condition`.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * What kind of value the setting holds, such as `text`, `template` (text that can read data as `{{ path }}`), `event`, `duration` or `condition`.
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
     * What the setting does; null when its label says enough.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What the setting does; null when its label says enough.
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
     * Whether the automation can't be activated without it.
     *
     * @return bool
     */
    public function getIsRequired(): bool
    {
        return $this->isRequired;
    }
    /**
     * Whether the automation can't be activated without it.
     *
     * @param bool $isRequired
     *
     * @return self
     */
    public function setIsRequired(bool $isRequired): self
    {
        $this->initialized['isRequired'] = true;
        $this->isRequired = $isRequired;
        return $this;
    }
    /**
     * A sample value Studio shows in an empty setting; null for none.
     *
     * @return string|null
     */
    public function getPlaceholder(): ?string
    {
        return $this->placeholder;
    }
    /**
     * A sample value Studio shows in an empty setting; null for none.
     *
     * @param string|null $placeholder
     *
     * @return self
     */
    public function setPlaceholder(?string $placeholder): self
    {
        $this->initialized['placeholder'] = true;
        $this->placeholder = $placeholder;
        return $this;
    }
    /**
     * The most characters a text setting takes; null for no limit.
     *
     * @return int|null
     */
    public function getMaxLength(): ?int
    {
        return $this->maxLength;
    }
    /**
     * The most characters a text setting takes; null for no limit.
     *
     * @param int|null $maxLength
     *
     * @return self
     */
    public function setMaxLength(?int $maxLength): self
    {
        $this->initialized['maxLength'] = true;
        $this->maxLength = $maxLength;
        return $this;
    }
}