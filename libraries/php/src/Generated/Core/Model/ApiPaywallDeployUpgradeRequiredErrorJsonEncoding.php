<?php

namespace Voidhash\Generated\Core\Model;

class ApiPaywallDeployUpgradeRequiredErrorJsonEncoding
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
     * @var string
     */
    protected $tag;
    /**
     * @var string
     */
    protected $message;
    /**
     * @var mixed|null
     */
    protected $schemaVersion;
    /**
     * @return string
     */
    public function getTag(): string
    {
        return $this->tag;
    }
    /**
     * @param string $tag
     *
     * @return self
     */
    public function setTag(string $tag): self
    {
        $this->initialized['tag'] = true;
        $this->tag = $tag;
        return $this;
    }
    /**
     * @return string
     */
    public function getMessage(): string
    {
        return $this->message;
    }
    /**
     * @param string $message
     *
     * @return self
     */
    public function setMessage(string $message): self
    {
        $this->initialized['message'] = true;
        $this->message = $message;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getSchemaVersion()
    {
        return $this->schemaVersion;
    }
    /**
     * @param mixed $schemaVersion
     *
     * @return self
     */
    public function setSchemaVersion($schemaVersion): self
    {
        $this->initialized['schemaVersion'] = true;
        $this->schemaVersion = $schemaVersion;
        return $this;
    }
}