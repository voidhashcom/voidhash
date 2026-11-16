<?php

namespace Voidhash\Generated\Core\Model;

class AutomationVariable
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
     * The variable's key, read as `vars.<key>`.
     *
     * @var string
     */
    protected $key;
    /**
     * A name for the variable, shown to whoever starts a run.
     *
     * @var string|null
     */
    protected $label;
    /**
     * The value it has unless whoever starts the run sets another: text, a number or a boolean.
     *
     * @var mixed|null
     */
    protected $defaultValue;
    /**
     * The variable's key, read as `vars.<key>`.
     *
     * @return string
     */
    public function getKey(): string
    {
        return $this->key;
    }
    /**
     * The variable's key, read as `vars.<key>`.
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
     * A name for the variable, shown to whoever starts a run.
     *
     * @return string|null
     */
    public function getLabel(): ?string
    {
        return $this->label;
    }
    /**
     * A name for the variable, shown to whoever starts a run.
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
     * The value it has unless whoever starts the run sets another: text, a number or a boolean.
     *
     * @return mixed
     */
    public function getDefaultValue()
    {
        return $this->defaultValue;
    }
    /**
     * The value it has unless whoever starts the run sets another: text, a number or a boolean.
     *
     * @param mixed $defaultValue
     *
     * @return self
     */
    public function setDefaultValue($defaultValue): self
    {
        $this->initialized['defaultValue'] = true;
        $this->defaultValue = $defaultValue;
        return $this;
    }
}