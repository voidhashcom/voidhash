<?php

namespace Voidhash\Generated\Core\Model;

class AnalyticsCohortJsonEncoding
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
     * The cohort's id, `an_cohort_...`.
     *
     * @var string
     */
    protected $id;
    /**
     * The project whose people it holds.
     *
     * @var string
     */
    protected $projectId;
    /**
     * The cohort's name, as Studio shows it.
     *
     * @var string
     */
    protected $name;
    /**
     * What the cohort is for; null without one.
     *
     * @var string|null
     */
    protected $description;
    /**
     * `static`: the cohort lists its people, added and removed by hand or by the API. `dynamic`: its `definition` describes them, and it holds whoever matches whenever it is read.
     *
     * @var string
     */
    protected $kind;
    /**
     * Who a dynamic cohort holds, worked out whenever it is read.
     *
     * @var AnalyticsCohortDefinition
     */
    protected $definition;
    /**
     * How many people it holds now: always for a static cohort. A dynamic cohort's people are counted only when it is read alone, so it is null in a list, in the answer to a change, and while its definition can't run because it names a cohort since deleted.
     *
     * @var int|null
     */
    protected $memberCount;
    /**
     * When the cohort was created, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $createdAt;
    /**
     * When the cohort last changed, as an ISO 8601 timestamp.
     *
     * @var string
     */
    protected $updatedAt;
    /**
     * The cohort's id, `an_cohort_...`.
     *
     * @return string
     */
    public function getId(): string
    {
        return $this->id;
    }
    /**
     * The cohort's id, `an_cohort_...`.
     *
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
     * The project whose people it holds.
     *
     * @return string
     */
    public function getProjectId(): string
    {
        return $this->projectId;
    }
    /**
     * The project whose people it holds.
     *
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
     * The cohort's name, as Studio shows it.
     *
     * @return string
     */
    public function getName(): string
    {
        return $this->name;
    }
    /**
     * The cohort's name, as Studio shows it.
     *
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
     * What the cohort is for; null without one.
     *
     * @return string|null
     */
    public function getDescription(): ?string
    {
        return $this->description;
    }
    /**
     * What the cohort is for; null without one.
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
     * `static`: the cohort lists its people, added and removed by hand or by the API. `dynamic`: its `definition` describes them, and it holds whoever matches whenever it is read.
     *
     * @return string
     */
    public function getKind(): string
    {
        return $this->kind;
    }
    /**
     * `static`: the cohort lists its people, added and removed by hand or by the API. `dynamic`: its `definition` describes them, and it holds whoever matches whenever it is read.
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
     * Who a dynamic cohort holds, worked out whenever it is read.
     *
     * @return AnalyticsCohortDefinition
     */
    public function getDefinition(): AnalyticsCohortDefinition
    {
        return $this->definition;
    }
    /**
     * Who a dynamic cohort holds, worked out whenever it is read.
     *
     * @param AnalyticsCohortDefinition $definition
     *
     * @return self
     */
    public function setDefinition(AnalyticsCohortDefinition $definition): self
    {
        $this->initialized['definition'] = true;
        $this->definition = $definition;
        return $this;
    }
    /**
     * How many people it holds now: always for a static cohort. A dynamic cohort's people are counted only when it is read alone, so it is null in a list, in the answer to a change, and while its definition can't run because it names a cohort since deleted.
     *
     * @return int|null
     */
    public function getMemberCount(): ?int
    {
        return $this->memberCount;
    }
    /**
     * How many people it holds now: always for a static cohort. A dynamic cohort's people are counted only when it is read alone, so it is null in a list, in the answer to a change, and while its definition can't run because it names a cohort since deleted.
     *
     * @param int|null $memberCount
     *
     * @return self
     */
    public function setMemberCount(?int $memberCount): self
    {
        $this->initialized['memberCount'] = true;
        $this->memberCount = $memberCount;
        return $this;
    }
    /**
     * When the cohort was created, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }
    /**
     * When the cohort was created, as an ISO 8601 timestamp.
     *
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
     * When the cohort last changed, as an ISO 8601 timestamp.
     *
     * @return string
     */
    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }
    /**
     * When the cohort last changed, as an ISO 8601 timestamp.
     *
     * @param string $updatedAt
     *
     * @return self
     */
    public function setUpdatedAt(string $updatedAt): self
    {
        $this->initialized['updatedAt'] = true;
        $this->updatedAt = $updatedAt;
        return $this;
    }
}