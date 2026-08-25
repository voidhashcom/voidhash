<?php

namespace Voidhash\Generated\Core\Model;

class UpdateDevelopmentSettingsBody
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
    protected $developmentPurchasesEnabled;
    /**
     * @var string|null
     */
    protected $projectId;
    /**
     * @return bool
     */
    public function getDevelopmentPurchasesEnabled(): bool
    {
        return $this->developmentPurchasesEnabled;
    }
    /**
     * @param bool $developmentPurchasesEnabled
     *
     * @return self
     */
    public function setDevelopmentPurchasesEnabled(bool $developmentPurchasesEnabled): self
    {
        $this->initialized['developmentPurchasesEnabled'] = true;
        $this->developmentPurchasesEnabled = $developmentPurchasesEnabled;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getProjectId(): ?string
    {
        return $this->projectId;
    }
    /**
     * @param string|null $projectId
     *
     * @return self
     */
    public function setProjectId(?string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
}