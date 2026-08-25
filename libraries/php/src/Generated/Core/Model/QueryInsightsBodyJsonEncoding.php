<?php

namespace Voidhash\Generated\Core\Model;

class QueryInsightsBodyJsonEncoding
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
    protected $projectId;
    /**
     * @var list<AnalyticsInsightQuery>
     */
    protected $queries;
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
    /**
     * @return list<AnalyticsInsightQuery>
     */
    public function getQueries(): array
    {
        return $this->queries;
    }
    /**
     * @param list<AnalyticsInsightQuery> $queries
     *
     * @return self
     */
    public function setQueries(array $queries): self
    {
        $this->initialized['queries'] = true;
        $this->queries = $queries;
        return $this;
    }
}