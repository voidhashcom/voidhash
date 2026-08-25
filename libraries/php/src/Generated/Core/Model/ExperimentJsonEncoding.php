<?php

namespace Voidhash\Generated\Core\Model;

class ExperimentJsonEncoding
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
     * @var string|null
     */
    protected $archivedAt;
    /**
     * @var ExperimentBackingFlagJsonEncoding
     */
    protected $backingFlag;
    /**
     * @var string|null
     */
    protected $createdAt;
    /**
     * @var string|null
     */
    protected $createdByUserId;
    /**
     * @var string|null
     */
    protected $description;
    /**
     * @var string|null
     */
    protected $endedAt;
    /**
     * @var string
     */
    protected $featureFlagId;
    /**
     * @var string|null
     */
    protected $hypothesis;
    /**
     * @var string
     */
    protected $id;
    /**
     * @var string
     */
    protected $name;
    /**
     * @var string|null
     */
    protected $primaryMetricEventName;
    /**
     * @var string
     */
    protected $projectId;
    /**
     * @var list<string>|null
     */
    protected $secondaryMetricEventNames;
    /**
     * @var string|null
     */
    protected $startedAt;
    /**
     * @var string
     */
    protected $status;
    /**
     * @var list<ExperimentTreatmentJsonEncoding>
     */
    protected $treatments;
    /**
     * @var string|null
     */
    protected $updatedAt;
    /**
     * @var string|null
     */
    protected $updatedByUserId;
    /**
     * @var list<ExperimentVariantJsonEncoding>
     */
    protected $variants;
    /**
     * @var mixed
     */
    protected $version;
    /**
     * @var string|null
     */
    protected $winningVariantId;
    /**
     * @return string|null
     */
    public function getArchivedAt(): ?string
    {
        return $this->archivedAt;
    }
    /**
     * @param string|null $archivedAt
     *
     * @return self
     */
    public function setArchivedAt(?string $archivedAt): self
    {
        $this->initialized['archivedAt'] = true;
        $this->archivedAt = $archivedAt;
        return $this;
    }
    /**
     * @return ExperimentBackingFlagJsonEncoding
     */
    public function getBackingFlag(): ExperimentBackingFlagJsonEncoding
    {
        return $this->backingFlag;
    }
    /**
     * @param ExperimentBackingFlagJsonEncoding $backingFlag
     *
     * @return self
     */
    public function setBackingFlag(ExperimentBackingFlagJsonEncoding $backingFlag): self
    {
        $this->initialized['backingFlag'] = true;
        $this->backingFlag = $backingFlag;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }
    /**
     * @param string|null $createdAt
     *
     * @return self
     */
    public function setCreatedAt(?string $createdAt): self
    {
        $this->initialized['createdAt'] = true;
        $this->createdAt = $createdAt;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getCreatedByUserId(): ?string
    {
        return $this->createdByUserId;
    }
    /**
     * @param string|null $createdByUserId
     *
     * @return self
     */
    public function setCreatedByUserId(?string $createdByUserId): self
    {
        $this->initialized['createdByUserId'] = true;
        $this->createdByUserId = $createdByUserId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
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
     * @return string|null
     */
    public function getEndedAt(): ?string
    {
        return $this->endedAt;
    }
    /**
     * @param string|null $endedAt
     *
     * @return self
     */
    public function setEndedAt(?string $endedAt): self
    {
        $this->initialized['endedAt'] = true;
        $this->endedAt = $endedAt;
        return $this;
    }
    /**
     * @return string
     */
    public function getFeatureFlagId(): string
    {
        return $this->featureFlagId;
    }
    /**
     * @param string $featureFlagId
     *
     * @return self
     */
    public function setFeatureFlagId(string $featureFlagId): self
    {
        $this->initialized['featureFlagId'] = true;
        $this->featureFlagId = $featureFlagId;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getHypothesis(): ?string
    {
        return $this->hypothesis;
    }
    /**
     * @param string|null $hypothesis
     *
     * @return self
     */
    public function setHypothesis(?string $hypothesis): self
    {
        $this->initialized['hypothesis'] = true;
        $this->hypothesis = $hypothesis;
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
     * @return string|null
     */
    public function getPrimaryMetricEventName(): ?string
    {
        return $this->primaryMetricEventName;
    }
    /**
     * @param string|null $primaryMetricEventName
     *
     * @return self
     */
    public function setPrimaryMetricEventName(?string $primaryMetricEventName): self
    {
        $this->initialized['primaryMetricEventName'] = true;
        $this->primaryMetricEventName = $primaryMetricEventName;
        return $this;
    }
    /**
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * @param string $projectId
     *
     * @return self
     */
    public function setProjectId(string $projectId): self
    {
        $this->initialized['projectId'] = true;
        $this->projectId = $projectId;
        return $this;
    }
    /**
     * @return list<string>|null
     */
    public function getSecondaryMetricEventNames(): ?array
    {
        return $this->secondaryMetricEventNames;
    }
    /**
     * @param list<string>|null $secondaryMetricEventNames
     *
     * @return self
     */
    public function setSecondaryMetricEventNames(?array $secondaryMetricEventNames): self
    {
        $this->initialized['secondaryMetricEventNames'] = true;
        $this->secondaryMetricEventNames = $secondaryMetricEventNames;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getStartedAt(): ?string
    {
        return $this->startedAt;
    }
    /**
     * @param string|null $startedAt
     *
     * @return self
     */
    public function setStartedAt(?string $startedAt): self
    {
        $this->initialized['startedAt'] = true;
        $this->startedAt = $startedAt;
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
    /**
     * @return list<ExperimentTreatmentJsonEncoding>
     */
    public function getTreatments(): array
    {
        return $this->treatments;
    }
    /**
     * @param list<ExperimentTreatmentJsonEncoding> $treatments
     *
     * @return self
     */
    public function setTreatments(array $treatments): self
    {
        $this->initialized['treatments'] = true;
        $this->treatments = $treatments;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getUpdatedAt(): ?string
    {
        return $this->updatedAt;
    }
    /**
     * @param string|null $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(?string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getUpdatedByUserId(): ?string
    {
        return $this->updatedByUserId;
    }
    /**
     * @param string|null $updatedByUserId
     *
     * @return self
     */
    public function setUpdatedByUserId(?string $updatedByUserId): self
    {
        $this->initialized['updatedByUserId'] = true;
        $this->updatedByUserId = $updatedByUserId;
        return $this;
    }
    /**
     * @return list<ExperimentVariantJsonEncoding>
     */
    public function getVariants(): array
    {
        return $this->variants;
    }
    /**
     * @param list<ExperimentVariantJsonEncoding> $variants
     *
     * @return self
     */
    public function setVariants(array $variants): self
    {
        $this->initialized['variants'] = true;
        $this->variants = $variants;
        return $this;
    }
    /**
     * @return mixed
     */
    public function getVersion()
    {
        return $this->version;
    }
    /**
     * @param mixed $version
     *
     * @return self
     */
    public function setVersion($version): self
    {
        $this->initialized['version'] = true;
        $this->version = $version;
        return $this;
    }
    /**
     * @return string|null
     */
    public function getWinningVariantId(): ?string
    {
        return $this->winningVariantId;
    }
    /**
     * @param string|null $winningVariantId
     *
     * @return self
     */
    public function setWinningVariantId(?string $winningVariantId): self
    {
        $this->initialized['winningVariantId'] = true;
        $this->winningVariantId = $winningVariantId;
        return $this;
    }
}