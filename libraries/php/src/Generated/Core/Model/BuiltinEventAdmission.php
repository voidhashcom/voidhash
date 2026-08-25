<?php

namespace Voidhash\Generated\Core\Model;

class BuiltinEventAdmission
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
     * @var bool
     */
    protected $defaultEnabled;
    /**
     * @var string
     */
    protected $description;
    /**
     * @var bool
     */
    protected $enabled;
    /**
     * @var list<string>
     */
    protected $eventNames;
    /**
     * @var string
     */
    protected $key;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var bool|null
     */
    protected $override;
    /**
     * @var string|null
     */
    protected $warning;
    /**
     * @return bool
     */
    public function getDefaultEnabled(): bool
    {
        return $this->defaultEnabled;
    }
    /**
     * @param bool $defaultEnabled
     *
     * @return self
     */
    public function setDefaultEnabled(bool $defaultEnabled): self
    {
        $this->initialized['defaultEnabled'] = true;
        $this->defaultEnabled = $defaultEnabled;
        return $this;
    }
    /**
     * @return string
     */
    public function getDescription(): string
    {
        return $this->description;
    }
    /**
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
     * @return bool
     */
    public function getEnabled(): bool
    {
        return $this->enabled;
    }
    /**
     * @param bool $enabled
     *
     * @return self
     */
    public function setEnabled(bool $enabled): self
    {
        $this->initialized['enabled'] = true;
        $this->enabled = $enabled;
        return $this;
    }
    /**
     * @return list<string>
     */
    public function getEventNames(): array
    {
        return $this->eventNames;
    }
    /**
     * @param list<string> $eventNames
     *
     * @return self
     */
    public function setEventNames(array $eventNames): self
    {
        $this->initialized['eventNames'] = true;
        $this->eventNames = $eventNames;
        return $this;
    }
    /**
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
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
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
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
     * @return bool|null
     */
    public function getOverride(): ?bool
    {
        return $this->override;
    }
    /**
     * @param bool|null $override
     *
     * @return self
     */
    public function setOverride(?bool $override): self
    {
        $this->initialized['override'] = true;
        $this->override = $override;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getWarning(): ?string
    {
        return $this->warning;
    }
    /**
     * @param string|null $warning
     *
     * @return self
     */
    public function setWarning(?string $warning): self
    {
        $this->initialized['warning'] = true;
        $this->warning = $warning;
        return $this;
    }
}