<?php

namespace Voidhash\Generated\Core\Model;

class PaywallDeployJsonEncoding
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
    protected $cliVersion;
    /**
     * @var list<PaywallDeployJsonEncodingComponentsItem>
     */
    protected $components;
    /**
     * @var string
     */
    protected $createdAt;
    /**
     * @var string
     */
    protected $createdByName;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var list<PaywallDeployJsonEncodingPaywallsItem>
     */
    protected $paywalls;
    /**
     * @var string
     */
    protected $runtimeVersion;
    /**
     * @var mixed
     */
    protected $schemaVersion;
    /**
     * @var string
     */
    protected $status;
    /**
     * @return string
     */
    public function getCliVersion(): string
    {
        return $this->cliVersion;
    }
    /**
     * @param string $cliVersion
     *
     * @return self
     */
    public function setCliVersion(string $cliVersion): self
    {
        $this->initialized['cliVersion'] = true;
        $this->cliVersion = $cliVersion;
        return $this;
    }
    /**
     * @return list<PaywallDeployJsonEncodingComponentsItem>
     */
    public function getComponents(): array
    {
        return $this->components;
    }
    /**
     * @param list<PaywallDeployJsonEncodingComponentsItem> $components
     *
     * @return self
     */
    public function setComponents(array $components): self
    {
        $this->initialized['components'] = true;
        $this->components = $components;
        return $this;
    }
    /**
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * @param string $createdAt
     *
     * @return self
     */
    public function setCreatedAt(string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * @return string
     */
    public function getCreatedByName(): string
    {
        return $this->createdByName;
    }
    /**
     * @param string $createdByName
     *
     * @return self
     */
    public function setCreatedByName(string $createdByName): self
    {
        $this->initialized['createdByName'] = true;
        $this->createdByName = $createdByName;
        return $this;
    }
    /**
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
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
     * @return list<PaywallDeployJsonEncodingPaywallsItem>
     */
    public function getPaywalls(): array
    {
        return $this->paywalls;
    }
    /**
     * @param list<PaywallDeployJsonEncodingPaywallsItem> $paywalls
     *
     * @return self
     */
    public function setPaywalls(array $paywalls): self
    {
        $this->initialized['paywalls'] = true;
        $this->paywalls = $paywalls;
        return $this;
    }
    /**
     * @return string
     */
    public function getRuntimeVersion(): string
    {
        return $this->runtimeVersion;
    }
    /**
     * @param string $runtimeVersion
     *
     * @return self
     */
    public function setRuntimeVersion(string $runtimeVersion): self
    {
        $this->initialized['runtimeVersion'] = true;
        $this->runtimeVersion = $runtimeVersion;
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
    /**
     * @return string
     */
    public function getStatus(): string
    {
        return $this->status;
    }
    /**
     * @param string $status
     *
     * @return self
     */
    public function setStatus(string $status): self
    {
        $this->initialized['status'] = true;
        $this->status = $status;
        return $this;
    }
}